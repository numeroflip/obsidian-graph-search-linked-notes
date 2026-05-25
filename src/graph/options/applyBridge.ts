import type { PluginSettings, ViewSettings } from "../../settings";
import { pluginDebugLog, type PluginDebugSettings } from "../debug/log";
import { summarizeStoredOptions, summarizeViewSettings } from "../debug/summarize";
import type { GraphDataEngine } from "../types";
import { ensureSetOptionsCapture } from "./captureSetOptions";
import {
	getEngineViewSettings,
	setEngineViewSettings,
} from "./engineSettings";
import {
	hasExplicitStoredKeys,
	readViewSettingsFromOptions,
	writeViewSettingsToOptions,
} from "./readFromOptions";
import { clearSearchSeedState } from "../searchSeeds";
import { rememberSetOptionsPayload } from "./rememberPayload";

function seedViewSettingsFromHistory(
	engine: GraphDataEngine,
	getDefaults: () => PluginSettings,
): ViewSettings {
	const defaults = getDefaults();
	const payload = engine.__linkedNotesLastSetOptionsPayload;
	if (payload && hasExplicitStoredKeys(payload)) {
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

export function applyLinkedNotesOptionsBridge(
	engine: GraphDataEngine,
	getDefaults: () => PluginSettings,
	onViewSettingsRestored?: (next: ViewSettings, prev: ViewSettings) => void,
	debug?: PluginDebugSettings,
): void {
	if (engine.__linkedNotesOptionsBridged) {
		return;
	}

	ensureSetOptionsCapture(engine, debug);

	if (
		typeof engine.getOptions !== "function" ||
		typeof engine.setOptions !== "function"
	) {
		console.warn(
			"[graph-search-linked-notes] dataEngine missing getOptions/setOptions",
		);
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
		let prev: ViewSettings | undefined;
		let next: ViewSettings | undefined;
		if (options) {
			rememberSetOptionsPayload(this, options, debug, "bridge");
			clearSearchSeedState(this);
			const defaults = getDefaults();
			prev = getEngineViewSettings(this, defaults);
			next = readViewSettingsFromOptions(options, defaults);
			setEngineViewSettings(this, next);
			if (debug?.debugLogging) {
				pluginDebugLog(debug, "setOptions-bridge", {
					seq: this.__linkedNotesSetOptionsSeq,
					prev: summarizeViewSettings(prev),
					next: summarizeViewSettings(next),
					stored: summarizeStoredOptions(options),
				});
			}
		}
		const result = origSet.call(this, options);
		if (prev !== undefined && next !== undefined) {
			onViewSettingsRestored?.(next, prev);
		}
		return result;
	};

	if (!engine.__linkedNotesViewSettings) {
		const seeded = seedViewSettingsFromHistory(engine, getDefaults);
		setEngineViewSettings(engine, seeded);
		if (debug?.debugLogging) {
			pluginDebugLog(debug, "bridge-seed", {
				seeded: summarizeViewSettings(seeded),
				payload: summarizeStoredOptions(
					engine.__linkedNotesLastSetOptionsPayload,
				),
			});
		}
	}
}
