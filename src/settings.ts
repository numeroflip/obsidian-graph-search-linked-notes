export interface PluginSettings {
	includeLinkedNotes: boolean;
	linkDepth: number;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	includeLinkedNotes: true,
	linkDepth: 1,
};

export const MIN_LINK_DEPTH = 1;
export const MAX_LINK_DEPTH = 3;

export function clampLinkDepth(depth: number): number {
	return Math.min(MAX_LINK_DEPTH, Math.max(MIN_LINK_DEPTH, Math.round(depth)));
}

/** Migrate saved data from older single-slider shape. */
export function normalizePluginSettings(
	data: Partial<PluginSettings> & { linkedNotesDepth?: number } | null,
): PluginSettings {
	if (!data) {
		return { ...DEFAULT_SETTINGS };
	}

	if (
		typeof data.includeLinkedNotes === "boolean" &&
		typeof data.linkDepth === "number"
	) {
		return {
			includeLinkedNotes: data.includeLinkedNotes,
			linkDepth: clampLinkDepth(data.linkDepth),
		};
	}

	if (typeof data.linkedNotesDepth === "number") {
		const depth = clampLinkDepth(
			data.linkedNotesDepth || DEFAULT_SETTINGS.linkDepth,
		);
		if (data.linkedNotesDepth <= 0) {
			return { includeLinkedNotes: false, linkDepth: DEFAULT_SETTINGS.linkDepth };
		}
		return { includeLinkedNotes: true, linkDepth: depth };
	}

	return { ...DEFAULT_SETTINGS };
}
