import type { PluginSettings, ViewSettings } from "../../settings";
import { fglnDebugLog, type FglnDebugSettings } from "../debug/log";
import { summarizeOptionsFgln, summarizeViewSettings } from "../debug/summarize";
import type { GraphDataEngine } from "../types";
import { ensureSetOptionsCapture } from "./captureSetOptions";
import {
	getEngineViewSettings,
	setEngineViewSettings,
} from "./engineSettings";
import {
	hasExplicitFglnKeys,
	readViewSettingsFromOptions,
	writeViewSettingsToOptions,
} from "./readFromOptions";
import { rememberSetOptionsPayload } from "./rememberPayload";

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
