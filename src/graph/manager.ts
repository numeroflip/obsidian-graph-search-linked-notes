import type { Plugin, WorkspaceLeaf } from "obsidian";
import {
	clampLinkDepth,
	type PluginSettings,
	type ViewSettings,
} from "../settings";
import {
	type LinkedNotesControlsSection,
	mountLinkedNotesControls,
	removeLinkedNotesControls,
} from "./controlsSection";
import { getGraphPluginOptionsBlob } from "./debug/graphPluginOptions";
import { pluginDebugLog } from "./debug/log";
import { summarizeStoredOptions, summarizeViewSettings } from "./debug/summarize";
import { clearExpansionCache } from "./expansion";
import { pruneLinkedExpansions } from "./fileFilter";
import { findGraphLeaves, isGraphView } from "./leaves";
import { applyLinkedNotesOptionsBridge } from "./options/applyBridge";
import { ensureSetOptionsCapture } from "./options/captureSetOptions";
import { getEngineViewSettings, setEngineViewSettings } from "./options/engineSettings";
import { removeLinkedNotesOptionsBridge } from "./options/removeBridge";
import {
	type ResolveViewSettingsMode,
	resolveViewSettings,
} from "./options/resolveSettings";
import { applyLinkedNotesPatch, removeLinkedNotesPatch } from "./patch";
import { clearSearchSeedCache } from "./searchSeeds";
import { hasActiveGraphSearch, isSearchScanPending } from "./searchState";
import type { GraphDataEngine, LinkedNotesPatchOptions } from "./types";

const METADATA_REFRESH_DEBOUNCE_MS = 300;
/** Bookmark setOptions may run after bind; re-read graph plugin store briefly. */
const POST_BIND_RECONCILE_DELAYS_MS = [0, 100];

interface GraphLeafBinding {
	engine: GraphDataEngine;
	controls: LinkedNotesControlsSection;
}

function settingsToPatchOptions(
	settings: ViewSettings,
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
	private readonly reconcileTimers = new Map<WorkspaceLeaf, number[]>();
	private metadataRefreshTimer: number | null = null;
	private destroyed = false;

	constructor(
		private readonly plugin: Plugin,
		private getDefaults: () => PluginSettings,
	) {
		const { app } = plugin;

		plugin.registerEvent(
			app.metadataCache.on("resolved", () => this.scheduleMetadataRefresh()),
		);
		plugin.registerEvent(
			app.metadataCache.on("changed", () => this.scheduleMetadataRefresh()),
		);
		plugin.registerEvent(
			app.workspace.on("active-leaf-change", (leaf) => {
				if (!leaf || !isGraphView(leaf.view)) {
					return;
				}
				this.captureGraphEngine(leaf.view.dataEngine, "active-leaf");
				if (this.bindings.has(leaf)) {
					this.reconcileLeafViewSettings(leaf, "active-leaf", "pane");
				} else {
					void this.tryBindLeaf(leaf);
				}
			}),
		);
	}

	private captureGraphEngine(
		engine: GraphDataEngine,
		source: string,
	): void {
		ensureSetOptionsCapture(engine, this.getDefaults());
		pluginDebugLog(this.getDefaults(), `capture-install:${source}`, {
			seq: engine.__linkedNotesSetOptionsSeq ?? 0,
			bridged: !!engine.__linkedNotesOptionsBridged,
		});
	}

	sync(): void {
		if (this.destroyed) {
			return;
		}

		const currentLeaves = new Set(findGraphLeaves(this.plugin.app));

		for (const leaf of currentLeaves) {
			const view = leaf.view;
			if (isGraphView(view)) {
				this.captureGraphEngine(view.dataEngine, "layout-sync");
			}
		}

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

		for (const timers of this.reconcileTimers.values()) {
			for (const timerId of timers) {
				window.clearTimeout(timerId);
			}
		}
		this.reconcileTimers.clear();

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

		for (const { engine } of this.bindings.values()) {
			const viewSettings = getEngineViewSettings(engine, this.getDefaults());
			if (!viewSettings.includeLinkedNotes) {
				continue;
			}

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

	private schedulePostBindReconcile(leaf: WorkspaceLeaf): void {
		const existing = this.reconcileTimers.get(leaf);
		if (existing) {
			for (const timerId of existing) {
				window.clearTimeout(timerId);
			}
		}

		const timers: number[] = [];
		for (const delay of POST_BIND_RECONCILE_DELAYS_MS) {
			const timerId = window.setTimeout(() => {
				this.reconcileTimers.set(
					leaf,
					(this.reconcileTimers.get(leaf) ?? []).filter((id) => id !== timerId),
				);
				this.reconcileLeafViewSettings(
					leaf,
					`post-bind+${delay}ms`,
					"bookmark",
				);
			}, delay);
			timers.push(timerId);
		}
		this.reconcileTimers.set(leaf, timers);
	}

	private reconcileLeafViewSettings(
		leaf: WorkspaceLeaf,
		source: string,
		mode: ResolveViewSettingsMode,
	): void {
		if (this.destroyed) {
			return;
		}

		const binding = this.bindings.get(leaf);
		if (!binding) {
			return;
		}

		const { engine, controls } = binding;
		const defaults = this.getDefaults();
		const prev = getEngineViewSettings(engine, defaults);
		const next = resolveViewSettings(
			engine,
			this.plugin.app,
			defaults,
			mode,
		);

		pluginDebugLog(this.getDefaults(), `reconcile:${source}`, {
			prev: summarizeViewSettings(prev),
			next: summarizeViewSettings(next),
			engine: summarizeViewSettings(
				getEngineViewSettings(engine, defaults),
			),
			payload: summarizeStoredOptions(
				engine.__linkedNotesLastSetOptionsPayload,
			),
			graphPlugin: summarizeStoredOptions(
				getGraphPluginOptionsBlob(this.plugin.app),
			),
			setOptionsSeq: engine.__linkedNotesSetOptionsSeq ?? 0,
		});

		if (
			prev.includeLinkedNotes === next.includeLinkedNotes &&
			prev.linkDepth === next.linkDepth
		) {
			return;
		}

		setEngineViewSettings(engine, next);
		controls.updateFromSettings(next);
		this.applyViewSettingsToEngine(engine, prev, next, { forceRender: true });
	}

	private applyViewSettingsToEngine(
		engine: GraphDataEngine,
		prev: ViewSettings,
		next: ViewSettings,
		opts: { rerunSearch?: boolean; forceRender?: boolean } = {},
	): void {
		const turningOff =
			prev.includeLinkedNotes && !next.includeLinkedNotes;
		const turningOn =
			!prev.includeLinkedNotes && next.includeLinkedNotes;

		if (opts.forceRender || turningOff || turningOn || opts.rerunSearch) {
			pluginDebugLog(this.getDefaults(), "apply-view-settings", {
				prev: summarizeViewSettings(prev),
				next: summarizeViewSettings(next),
				turningOff,
				turningOn,
				forceRender: !!opts.forceRender,
				rerunSearch: !!opts.rerunSearch,
			});
		}

		if (turningOff) {
			const seeds = engine.__linkedNotesSeedPaths;
			if (seeds) {
				pruneLinkedExpansions(engine, seeds);
			}
			clearSearchSeedCache(engine);
			engine.render();
			return;
		}

		if (!opts.forceRender && !turningOn && !opts.rerunSearch) {
			if (!next.includeLinkedNotes || !hasActiveGraphSearch(engine)) {
				return;
			}
		}

		if (turningOn) {
			clearSearchSeedCache(engine);
			if (isSearchScanPending(engine)) {
				engine.updateSearch();
			} else {
				engine.render();
			}
			return;
		}

		if (opts.rerunSearch) {
			clearSearchSeedCache(engine);
			engine.updateSearch();
			return;
		}

		if (!hasActiveGraphSearch(engine)) {
			return;
		}

		clearExpansionCache(engine);
		engine.render();
	}

	private onViewSettingsRestored(
		leaf: WorkspaceLeaf,
		engine: GraphDataEngine,
		next: ViewSettings,
		prev: ViewSettings,
	): void {
		const binding = this.bindings.get(leaf);
		if (binding?.engine === engine) {
			binding.controls.updateFromSettings(next);
		}
		this.applyViewSettingsToEngine(engine, prev, next);
	}

	private cleanupGraphLeaf(leaf: WorkspaceLeaf): void {
		const view = leaf.view;
		if (!isGraphView(view)) {
			return;
		}

		const engine = view.dataEngine;
		removeLinkedNotesControls(engine);
		removeLinkedNotesPatch(engine);
		removeLinkedNotesOptionsBridge(engine);
	}

	private ensureOptionsBridge(leaf: WorkspaceLeaf, engine: GraphDataEngine): void {
		this.captureGraphEngine(engine, "ensure-bridge");
		applyLinkedNotesOptionsBridge(
			engine,
			() => this.getDefaults(),
			(next, prev) => this.onViewSettingsRestored(leaf, engine, next, prev),
			this.getDefaults(),
		);
	}

	private async tryBindLeaf(leaf: WorkspaceLeaf, attempt = 0): Promise<void> {
		if (this.destroyed) {
			return;
		}

		const preView = leaf.view;
		if (isGraphView(preView)) {
			this.ensureOptionsBridge(leaf, preView.dataEngine);
		}

		pluginDebugLog(this.getDefaults(), "tryBindLeaf:start", { attempt });

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
		if (!engine.__linkedNotesOptionsBridged) {
			this.ensureOptionsBridge(leaf, engine);
		}

		if (!engine.controlsEl?.isConnected) {
			if (attempt < 10) {
				this.scheduleBindRetry(leaf, attempt);
			}
			return;
		}

		const defaults = this.getDefaults();
		const viewSettings = resolveViewSettings(
			engine,
			this.plugin.app,
			defaults,
			"bookmark",
		);
		setEngineViewSettings(engine, viewSettings);

		pluginDebugLog(this.getDefaults(), "tryBindLeaf:mount", {
			attempt,
			viewSettings: summarizeViewSettings(viewSettings),
			payload: summarizeStoredOptions(
				engine.__linkedNotesLastSetOptionsPayload,
			),
			graphPlugin: summarizeStoredOptions(
				getGraphPluginOptionsBlob(this.plugin.app),
			),
		});

		const controls = mountLinkedNotesControls(
			engine,
			viewSettings,
			(next, rerunSearch) => {
				this.onControlsChanged(leaf, next, rerunSearch);
			},
		);

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

		this.bindings.set(leaf, { engine, controls });

		applyLinkedNotesPatch(this.plugin, engine, () =>
			settingsToPatchOptions(
				getEngineViewSettings(engine, this.getDefaults()),
				engine,
			),
		);

		this.applyViewSettingsToEngine(
			engine,
			viewSettings,
			viewSettings,
			{ forceRender: true },
		);

		this.schedulePostBindReconcile(leaf);
	}

	private onControlsChanged(
		sourceLeaf: WorkspaceLeaf,
		state: ViewSettings,
		rerunSearch = false,
	): void {
		if (this.destroyed) {
			return;
		}

		const binding = this.bindings.get(sourceLeaf);
		if (!binding) {
			return;
		}

		const engine = binding.engine;
		const prev = getEngineViewSettings(engine, this.getDefaults());
		const next: ViewSettings = {
			includeLinkedNotes: state.includeLinkedNotes,
			linkDepth: clampLinkDepth(state.linkDepth),
		};
		setEngineViewSettings(engine, next);
		this.applyViewSettingsToEngine(engine, prev, next, { rerunSearch });
	}

	private unbindLeaf(leaf: WorkspaceLeaf, binding: GraphLeafBinding): void {
		const retry = this.bindRetryTimers.get(leaf);
		if (retry != null) {
			window.clearTimeout(retry);
			this.bindRetryTimers.delete(leaf);
		}

		const reconcile = this.reconcileTimers.get(leaf);
		if (reconcile) {
			for (const timerId of reconcile) {
				window.clearTimeout(timerId);
			}
			this.reconcileTimers.delete(leaf);
		}

		binding.controls.destroy();
		this.cleanupGraphLeaf(leaf);
		this.bindings.delete(leaf);
	}
}
