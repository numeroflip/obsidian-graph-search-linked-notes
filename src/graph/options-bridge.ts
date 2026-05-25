import type { App } from "obsidian";
import {
	clampLinkDepth,
	type PluginSettings,
	type ViewSettings,
} from "../settings";
import {
	fglnDebugLog,
	getGraphPluginOptionsBlob,
	summarizeOptionsFgln,
	summarizeViewSettings,
	type FglnDebugSettings,
} from "./debug";
import type { GraphDataEngine } from "./types";

/** Keys stored in graph dataEngine.getOptions() / bookmarks type:"graph". */
const FGLN_INCLUDE_KEY = "fglnIncludeLinkedNotes";
const FGLN_DEPTH_KEY = "fglnLinkDepth";

export function hasExplicitFglnKeys(
	options: Record<string, unknown> | null | undefined,
): boolean {
	if (!options) {
		return false;
	}
	return (
		typeof options[FGLN_INCLUDE_KEY] === "boolean" ||
		typeof options[FGLN_DEPTH_KEY] === "number"
	);
}

export function readViewSettingsFromOptions(
	options: Record<string, unknown> | null | undefined,
	defaults: PluginSettings,
): ViewSettings {
	if (!options) {
		return { ...defaults };
	}

	const include = options[FGLN_INCLUDE_KEY];
	const depth = options[FGLN_DEPTH_KEY];
	const hasInclude = typeof include === "boolean";
	const hasDepth = typeof depth === "number";

	if (!hasInclude && !hasDepth) {
		return { ...defaults };
	}

	return {
		includeLinkedNotes: hasInclude
			? include
			: defaults.includeLinkedNotes,
		linkDepth: hasDepth
			? clampLinkDepth(depth)
			: defaults.linkDepth,
	};
}

function writeViewSettingsToOptions(
	options: Record<string, unknown>,
	settings: ViewSettings,
): void {
	options[FGLN_INCLUDE_KEY] = settings.includeLinkedNotes;
	options[FGLN_DEPTH_KEY] = clampLinkDepth(settings.linkDepth);
}

function rememberSetOptionsPayload(
	engine: GraphDataEngine,
	options: Record<string, unknown>,
	debug?: FglnDebugSettings,
	source?: string,
): void {
	engine.__linkedNotesLastSetOptionsPayload = options;
	engine.__linkedNotesSetOptionsSeq =
		(engine.__linkedNotesSetOptionsSeq ?? 0) + 1;
	if (debug?.debugLogging) {
		fglnDebugLog(debug, `setOptions-payload${source ? `:${source}` : ""}`, {
			seq: engine.__linkedNotesSetOptionsSeq,
			fgln: summarizeOptionsFgln(options),
			search:
				typeof options.search === "string"
					? options.search.slice(0, 80)
					: undefined,
		});
	}
}

function seedViewSettingsFromHistory(
	engine: GraphDataEngine,
	getDefaults: () => PluginSettings,
): ViewSettings {
	const defaults = getDefaults();
	const payload = engine.__linkedNotesLastSetOptionsPayload;
	if (payload && hasExplicitFglnKeys(payload)) {
		return readViewSettingsFromOptions(payload, defaults);
	}
	const origGet = engine.__linkedNotesOrigGetOptions ?? engine.getOptions;
	if (typeof origGet === "function") {
		return readViewSettingsFromOptions(
			origGet.call(engine) as Record<string, unknown>,
			defaults,
		);
	}
	return { ...defaults };
}

/**
 * How to merge engine memory, last setOptions payload, and graph plugin store.
 * - bookmark: prefer graph plugin / payload (fixes cold-open bookmark race).
 * - pane: prefer this engine’s settings (avoids cross-tab bleed from global graph store).
 */
export type ResolveViewSettingsMode = "bookmark" | "pane";

export function resolveViewSettings(
	engine: GraphDataEngine,
	app: App,
	defaults: PluginSettings,
	mode: ResolveViewSettingsMode = "bookmark",
): ViewSettings {
	const fromEngine = getEngineViewSettings(engine, defaults);
	const payload = engine.__linkedNotesLastSetOptionsPayload;
	const fromPayload =
		payload && hasExplicitFglnKeys(payload)
			? readViewSettingsFromOptions(payload, defaults)
			: null;
	const graphBlob = getGraphPluginOptionsBlob(app);
	const fromGraphPlugin =
		graphBlob && hasExplicitFglnKeys(graphBlob)
			? readViewSettingsFromOptions(graphBlob, defaults)
			: null;

	if (mode === "pane" && engine.__linkedNotesViewSettings) {
		return fromEngine;
	}
	if (fromGraphPlugin) {
		return fromGraphPlugin;
	}
	if (fromPayload) {
		return fromPayload;
	}
	return fromEngine;
}

export function ensureSetOptionsCapture(
	engine: GraphDataEngine,
	debug?: FglnDebugSettings,
): void {
	if (engine.__linkedNotesSetOptionsCaptureInstalled) {
		return;
	}
	if (typeof engine.setOptions !== "function") {
		return;
	}

	const origSet = engine.setOptions.bind(engine);
	engine.__linkedNotesSetOptionsCaptureInstalled = true;
	engine.setOptions = function capturedSetOptions(
		this: GraphDataEngine,
		options: Record<string, unknown>,
	) {
		if (options) {
			rememberSetOptionsPayload(this, options, debug, "capture");
		}
		return origSet.call(this, options);
	};
}

export function getEngineViewSettings(
	engine: GraphDataEngine,
	defaults: PluginSettings,
): ViewSettings {
	return engine.__linkedNotesViewSettings ?? { ...defaults };
}

export function setEngineViewSettings(
	engine: GraphDataEngine,
	settings: ViewSettings,
): void {
	engine.__linkedNotesViewSettings = {
		includeLinkedNotes: settings.includeLinkedNotes,
		linkDepth: clampLinkDepth(settings.linkDepth),
	};
}

export function applyLinkedNotesOptionsBridge(
	engine: GraphDataEngine,
	getDefaults: () => PluginSettings,
	onViewSettingsRestored?: (next: ViewSettings, prev: ViewSettings) => void,
	debug?: FglnDebugSettings,
): void {
	if (engine.__linkedNotesOptionsBridged) {
		return;
	}

	ensureSetOptionsCapture(engine, debug);

	if (
		typeof engine.getOptions !== "function" ||
		typeof engine.setOptions !== "function"
	) {
		console.warn("[filtered-graph] dataEngine missing getOptions/setOptions");
		setEngineViewSettings(engine, getDefaults());
		return;
	}

	const origGet = engine.getOptions.bind(engine);
	const origSet = engine.setOptions.bind(engine);

	engine.__linkedNotesOrigGetOptions = origGet;
	engine.__linkedNotesOrigSetOptions = origSet;
	engine.__linkedNotesOptionsBridged = true;

	engine.getOptions = function patchedGetOptions(this: GraphDataEngine) {
		const options = origGet.call(this) as Record<string, unknown>;
		writeViewSettingsToOptions(
			options,
			getEngineViewSettings(this, getDefaults()),
		);
		return options;
	};

	engine.setOptions = function patchedSetOptions(
		this: GraphDataEngine,
		options: Record<string, unknown>,
	) {
		if (options) {
			rememberSetOptionsPayload(this, options, debug, "bridge");
			const defaults = getDefaults();
			const prev = getEngineViewSettings(this, defaults);
			const next = readViewSettingsFromOptions(options, defaults);
			setEngineViewSettings(this, next);
			if (debug?.debugLogging) {
				fglnDebugLog(debug, "setOptions-bridge", {
					seq: this.__linkedNotesSetOptionsSeq,
					prev: summarizeViewSettings(prev),
					next: summarizeViewSettings(next),
					fgln: summarizeOptionsFgln(options),
				});
			}
			onViewSettingsRestored?.(next, prev);
		}
		return origSet.call(this, options);
	};

	if (!engine.__linkedNotesViewSettings) {
		const seeded = seedViewSettingsFromHistory(engine, getDefaults);
		setEngineViewSettings(engine, seeded);
		if (debug?.debugLogging) {
			fglnDebugLog(debug, "bridge-seed", {
				seeded: summarizeViewSettings(seeded),
				payload: summarizeOptionsFgln(
					engine.__linkedNotesLastSetOptionsPayload,
				),
			});
		}
	}
}

export function removeLinkedNotesOptionsBridge(engine: GraphDataEngine): void {
	const origGet = engine.__linkedNotesOrigGetOptions;
	const origSet = engine.__linkedNotesOrigSetOptions;

	if (origGet) {
		engine.getOptions = origGet;
	}
	if (origSet) {
		engine.setOptions = origSet;
	}

	delete engine.__linkedNotesOrigGetOptions;
	delete engine.__linkedNotesOrigSetOptions;
	delete engine.__linkedNotesOptionsBridged;
	delete engine.__linkedNotesViewSettings;
	delete engine.__linkedNotesLastSetOptionsPayload;
	delete engine.__linkedNotesSetOptionsSeq;
	delete engine.__linkedNotesSetOptionsCaptureInstalled;
}
