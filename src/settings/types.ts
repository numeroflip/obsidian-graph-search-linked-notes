/**
 * Persisted plugin data (`data.json`).
 * `includeLinkedNotes` and `linkDepth` are defaults only — graph UI and bookmarks
 * store per-view state; toggling the graph does not write these back.
 */
export interface PluginSettings {
	includeLinkedNotes: boolean;
	linkDepth: number;
	debugLogging?: boolean;
}

/** Per graph pane / bookmark: include toggle + depth. */
export type ViewSettings = Pick<
	PluginSettings,
	"includeLinkedNotes" | "linkDepth"
>;
