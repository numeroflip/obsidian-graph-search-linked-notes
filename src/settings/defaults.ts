import type { PluginSettings } from "./types";

export const DEFAULT_SETTINGS: PluginSettings = {
	includeLinkedNotes: false,
	linkDepth: 1,
	debugLogging: false,
};

export const MIN_LINK_DEPTH = 1;
export const MAX_LINK_DEPTH = 3;

export function clampLinkDepth(depth: number): number {
	return Math.min(MAX_LINK_DEPTH, Math.max(MIN_LINK_DEPTH, Math.round(depth)));
}
