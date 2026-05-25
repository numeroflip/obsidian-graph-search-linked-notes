import type { ViewSettings } from "../../settings";
import { GRAPH_SEARCH_DEPTH_KEY, GRAPH_SEARCH_INCLUDE_KEY } from "../options/keys";

export function summarizeViewSettings(settings: ViewSettings): string {
	return `include=${settings.includeLinkedNotes} depth=${settings.linkDepth}`;
}

export function summarizeStoredOptions(
	options: Record<string, unknown> | null | undefined,
): string {
	if (!options) {
		return "stored=(none)";
	}
	const include = options[GRAPH_SEARCH_INCLUDE_KEY];
	const depth = options[GRAPH_SEARCH_DEPTH_KEY];
	const parts: string[] = [];
	if (typeof include === "boolean") {
		parts.push(`include=${include}`);
	}
	if (typeof depth === "number") {
		parts.push(`depth=${depth}`);
	}
	return parts.length > 0 ? parts.join(" ") : "stored=(absent)";
}
