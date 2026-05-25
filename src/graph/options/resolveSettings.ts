import type { App } from "obsidian";
import type { PluginSettings, ViewSettings } from "../../settings";
import { getGraphPluginOptionsBlob } from "../debug/graphPluginOptions";
import type { GraphDataEngine } from "../types";
import { getEngineViewSettings } from "./engineSettings";
import { hasExplicitFglnKeys, readViewSettingsFromOptions } from "./readFromOptions";

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
