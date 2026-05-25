import type { Plugin, WorkspaceLeaf } from "obsidian";
import {
	clampLinkDepth,
	type PluginSettings,
} from "../settings";
import {
	type LinkedNotesControlState,
	type LinkedNotesControlsSection,
	mountLinkedNotesControls,
	removeLinkedNotesControls,
} from "./controls-section";
import { applyLinkedNotesPatch, removeLinkedNotesPatch } from "./patch";
import {
	clearExpansionCache,
	clearSearchSeedCache,
	findGraphLeaves,
	hasActiveGraphSearch,
	isGraphView,
	isSearchScanPending,
	pruneLinkedExpansions,
} from "./utils";
import type { GraphDataEngine, LinkedNotesPatchOptions } from "./types";

const METADATA_REFRESH_DEBOUNCE_MS = 300;

interface GraphLeafBinding {
	controls: LinkedNotesControlsSection;
}

function settingsToPatchOptions(
	settings: PluginSettings,
	engine: GraphDataEngine,
): LinkedNotesPatchOptions {
	return {
		enabled:
			settings.includeLinkedNotes && hasActiveGraphSearch(engine),
		depth: clampLinkDepth(settings.linkDepth),
	};
}

export class GraphLinkedNotesManager {
	private readonly bindings = new Map<WorkspaceLeaf, GraphLeafBinding>();
	private readonly bindRetryTimers = new Map<WorkspaceLeaf, number>();
	private metadataRefreshTimer: number | null = null;
	private destroyed = false;

	constructor(
		private readonly plugin: Plugin,
		private getSettings: () => PluginSettings,
		private saveSettings: (settings: PluginSettings) => Promise<void>,
	) {
		const { metadataCache } = plugin.app;
		plugin.registerEvent(
			metadataCache.on("resolved", () => this.scheduleMetadataRefresh()),
		);
		plugin.registerEvent(
			metadataCache.on("changed", () => this.scheduleMetadataRefresh()),
		);
	}

	sync(): void {
		if (this.destroyed) {
			return;
		}

		const currentLeaves = new Set(findGraphLeaves(this.plugin.app));

		for (const [leaf, binding] of this.bindings) {
			if (!currentLeaves.has(leaf)) {
				this.unbindLeaf(leaf, binding);
			}
		}

		for (const leaf of currentLeaves) {
			if (!this.bindings.has(leaf)) {
				void this.tryBindLeaf(leaf);
			}
		}
	}

	destroy(): void {
		this.destroyed = true;

		if (this.metadataRefreshTimer != null) {
			window.clearTimeout(this.metadataRefreshTimer);
			this.metadataRefreshTimer = null;
		}

		for (const timerId of this.bindRetryTimers.values()) {
			window.clearTimeout(timerId);
		}
		this.bindRetryTimers.clear();

		for (const [leaf, binding] of [...this.bindings]) {
			this.unbindLeaf(leaf, binding);
		}
		this.bindings.clear();
	}

	private scheduleMetadataRefresh(): void {
		if (this.destroyed || this.bindings.size === 0) {
			return;
		}

		if (this.metadataRefreshTimer != null) {
			window.clearTimeout(this.metadataRefreshTimer);
		}

		this.metadataRefreshTimer = window.setTimeout(() => {
			this.metadataRefreshTimer = null;
			this.refreshAllEnginesAfterMetadataChange();
		}, METADATA_REFRESH_DEBOUNCE_MS);
	}

	private refreshAllEnginesAfterMetadataChange(): void {
		if (this.destroyed) {
			return;
		}

		const settings = this.getSettings();
		if (!settings.includeLinkedNotes) {
			return;
		}

		for (const leaf of this.bindings.keys()) {
			const view = leaf.view;
			if (!isGraphView(view)) {
				continue;
			}

			const engine = view.dataEngine;
			if (!hasActiveGraphSearch(engine)) {
				continue;
			}

			clearExpansionCache(engine);
			engine.render();
		}
	}

	private scheduleBindRetry(leaf: WorkspaceLeaf, attempt: number): void {
		const existing = this.bindRetryTimers.get(leaf);
		if (existing != null) {
			window.clearTimeout(existing);
		}

		const timerId = window.setTimeout(() => {
			this.bindRetryTimers.delete(leaf);
			void this.tryBindLeaf(leaf, attempt + 1);
		}, 100);
		this.bindRetryTimers.set(leaf, timerId);
	}

	private cleanupGraphLeaf(leaf: WorkspaceLeaf): void {
		const view = leaf.view;
		if (!isGraphView(view)) {
			return;
		}

		const engine = view.dataEngine;
		removeLinkedNotesControls(engine);
		removeLinkedNotesPatch(engine);
	}

	private async tryBindLeaf(leaf: WorkspaceLeaf, attempt = 0): Promise<void> {
		if (this.destroyed) {
			return;
		}

		await leaf.loadIfDeferred();
		if (this.destroyed) {
			return;
		}
		const view = leaf.view;
		if (!isGraphView(view)) {
			if (attempt < 10) {
				this.scheduleBindRetry(leaf, attempt);
			}
			return;
		}

		if (this.bindings.has(leaf)) return;

		const engine = view.dataEngine;
		if (!engine.controlsEl?.isConnected) {
			if (attempt < 10) {
				this.scheduleBindRetry(leaf, attempt);
			}
			return;
		}

		const settings = this.getSettings();

		const controls = mountLinkedNotesControls(engine, settings, (next, rerunSearch) => {
			this.onControlsChanged(leaf, next, rerunSearch);
		});

		if (!controls) {
			if (attempt < 10) {
				this.scheduleBindRetry(leaf, attempt);
			}
			return;
		}

		if (this.destroyed) {
			controls.destroy();
			return;
		}

		this.bindings.set(leaf, { controls });

		applyLinkedNotesPatch(this.plugin, engine, () =>
			settingsToPatchOptions(this.getSettings(), engine),
		);

		if (hasActiveGraphSearch(engine)) {
			engine.render();
		}
	}

	private onControlsChanged(
		sourceLeaf: WorkspaceLeaf,
		state: LinkedNotesControlState,
		rerunSearch = false,
	): void {
		if (this.destroyed) {
			return;
		}

		if (!this.bindings.has(sourceLeaf)) {
			return;
		}

		const prev = this.getSettings();
		const next: PluginSettings = {
			includeLinkedNotes: state.includeLinkedNotes,
			linkDepth: clampLinkDepth(state.linkDepth),
		};
		const turningOff =
			prev.includeLinkedNotes && !next.includeLinkedNotes;
		const turningOn =
			!prev.includeLinkedNotes && next.includeLinkedNotes;

		void this.saveSettings(next);

		for (const [leaf, binding] of this.bindings) {
			if (leaf !== sourceLeaf) {
				binding.controls.updateFromSettings(next);
			}
		}

		for (const leaf of this.bindings.keys()) {
			const view = leaf.view;
			if (!isGraphView(view)) {
				continue;
			}

			const engine = view.dataEngine;

			if (turningOff) {
				const seeds = engine.__linkedNotesSeedPaths;
				if (seeds) {
					pruneLinkedExpansions(engine, seeds);
				}
				clearSearchSeedCache(engine);
				engine.render();
				continue;
			}

			if (turningOn) {
				clearSearchSeedCache(engine);
				if (isSearchScanPending(engine)) {
					engine.updateSearch();
				} else {
					engine.render();
				}
				continue;
			}

			if (rerunSearch) {
				clearSearchSeedCache(engine);
				engine.updateSearch();
				continue;
			}

			clearExpansionCache(engine);
			engine.render();
		}
	}

	private unbindLeaf(leaf: WorkspaceLeaf, binding: GraphLeafBinding): void {
		const retry = this.bindRetryTimers.get(leaf);
		if (retry != null) {
			window.clearTimeout(retry);
			this.bindRetryTimers.delete(leaf);
		}

		binding.controls.destroy();
		this.cleanupGraphLeaf(leaf);
		this.bindings.delete(leaf);
	}
}
