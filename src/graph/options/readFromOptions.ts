import { clampLinkDepth, type PluginSettings, type ViewSettings } from "../../settings";
import { FGLN_DEPTH_KEY, FGLN_INCLUDE_KEY } from "./keys";

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

export function writeViewSettingsToOptions(
	options: Record<string, unknown>,
	settings: ViewSettings,
): void {
	options[FGLN_INCLUDE_KEY] = settings.includeLinkedNotes;
	options[FGLN_DEPTH_KEY] = clampLinkDepth(settings.linkDepth);
}
