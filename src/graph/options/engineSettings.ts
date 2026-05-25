import { clampLinkDepth, type PluginSettings, type ViewSettings } from "../../settings";
import type { GraphDataEngine } from "../types";

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
