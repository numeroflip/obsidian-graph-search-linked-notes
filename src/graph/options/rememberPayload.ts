import { fglnDebugLog, type FglnDebugSettings } from "../debug/log";
import { summarizeOptionsFgln } from "../debug/summarize";
import type { GraphDataEngine } from "../types";

export function rememberSetOptionsPayload(
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
