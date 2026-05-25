import type { App } from "obsidian";

export const GLOBAL_GRAPH_VIEW_TYPE = "graph";

/** Internal async worker used by setQuery (class `sx` + `ax` in app.js). */
export interface GraphSearchQueue {
	runnable: {
		isRunning(): boolean;
	};
}

export interface LinkedNotesPatchOptions {
	enabled: boolean;
	depth: number;
}

/** Internal graph data engine (class `xJ` in Obsidian app.js). */
export interface GraphDataEngine {
	app: App;
	controlsEl: HTMLElement;
	fileFilter: Record<string, boolean | object>;
	/** Search scan worker; stays assigned after setQuery until the next search. */
	queue: GraphSearchQueue | null;
	filterOptions: {
		search?: {
			getValue(): string;
			inputEl: HTMLInputElement;
			clearButtonEl?: HTMLElement;
		};
	};
	render: () => void;
	/** Synchronous search filter rebuild (not debounced). */
	updateSearch(): void;
	__linkedNotesPatched?: boolean;
	__linkedNotesOrigRender?: () => void;
	__linkedNotesGetOptions?: () => LinkedNotesPatchOptions;
	/** Search-only match paths; fileFilter is mutated by expansion between renders. */
	__linkedNotesSeedPaths?: Set<string>;
	__linkedNotesLastSearch?: string;
	/** Cached BFS result keyed by search + depth + seeds. */
	__linkedNotesExpansionKey?: string;
	__linkedNotesExpanded?: Set<string>;
}

/** Global graph view (class `kJ` in Obsidian app.js). */
export interface GraphViewInternal {
	getViewType(): string;
	dataEngine: GraphDataEngine;
}
