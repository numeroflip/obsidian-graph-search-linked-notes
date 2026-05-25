import { pluginDebugLog, type PluginDebugSettings } from "../debug/log";
import { summarizeStoredOptions } from "../debug/summarize";
import type { GraphDataEngine } from "../types";

export function rememberSetOptionsPayload(
	engine: GraphDataEngine,
	options: Record<string, unknown>,
	debug?: PluginDebugSettings,
	source?: string,
): void {
	engine.__linkedNotesLastSetOptionsPayload = options;
	engine.__linkedNotesSetOptionsSeq =
		(engine.__linkedNotesSetOptionsSeq ?? 0) + 1;
	if (debug?.debugLogging) {
		pluginDebugLog(debug, `setOptions-payload${source ? `:${source}` : ""}`, {
			seq: engine.__linkedNotesSetOptionsSeq,
			stored: summarizeStoredOptions(options),
		});
	}
}
