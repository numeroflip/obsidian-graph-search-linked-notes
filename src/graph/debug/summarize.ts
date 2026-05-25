import type { ViewSettings } from "../../settings";
import { FGLN_DEPTH_KEY, FGLN_INCLUDE_KEY } from "../options/keys";

export function summarizeViewSettings(settings: ViewSettings): string {
	return `include=${settings.includeLinkedNotes} depth=${settings.linkDepth}`;
}

export function summarizeOptionsFgln(
	options: Record<string, unknown> | null | undefined,
): string {
	if (!options) {
		return "fgln=(none)";
	}
	const include = options[FGLN_INCLUDE_KEY];
	const depth = options[FGLN_DEPTH_KEY];
	const parts: string[] = [];
	if (typeof include === "boolean") {
		parts.push(`include=${include}`);
	}
	if (typeof depth === "number") {
		parts.push(`depth=${depth}`);
	}
	return parts.length > 0 ? parts.join(" ") : "fgln=(absent)";
}
