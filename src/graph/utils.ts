import type { App, WorkspaceLeaf } from "obsidian";
import type { GraphDataEngine, GraphViewInternal } from "./types";
import { GLOBAL_GRAPH_VIEW_TYPE } from "./types";

export function isGraphView(view: unknown): view is GraphViewInternal {
	if (!view || typeof view !== "object") return false;
	const v = view as GraphViewInternal;
	return (
		typeof v.getViewType === "function" &&
		v.getViewType() === GLOBAL_GRAPH_VIEW_TYPE &&
		v.dataEngine != null
	);
}

export function findGraphLeaves(app: App): WorkspaceLeaf[] {
	return app.workspace.getLeavesOfType(GLOBAL_GRAPH_VIEW_TYPE);
}

export function getGraphSearchInput(
	engine: GraphDataEngine,
): HTMLInputElement | null {
	const search = engine.filterOptions?.search;
	if (search?.inputEl) {
		return search.inputEl;
	}
	return engine.controlsEl.querySelector(
		'.graph-control-section.mod-filter input[type="search"], .graph-control-section.mod-filter input[type="text"]',
	);
}

/** Same source as the graph engine's updateSearch() (filterOptions.search.getValue). */
function getSearchQuery(engine: GraphDataEngine): string {
	const fromApi = engine.filterOptions?.search?.getValue?.()?.trim();
	if (fromApi) {
		return fromApi;
	}
	return getGraphSearchInput(engine)?.value.trim() ?? "";
}

/** True only while the vault scan is actively running (not merely queue assigned). */
export function isSearchScanPending(engine: GraphDataEngine): boolean {
	return engine.queue?.runnable?.isRunning() ?? false;
}

export function hasActiveGraphSearch(engine: GraphDataEngine): boolean {
	return getSearchQuery(engine).length > 0;
}

function isSearchFilterMatch(value: boolean | object): boolean {
	return value === true || (typeof value === "object" && value !== null);
}

/** Read paths that match the current search from a clean fileFilter. */
function collectSearchMatchPaths(engine: GraphDataEngine): string[] {
	return Object.entries(engine.fileFilter)
		.filter(([, value]) => isSearchFilterMatch(value))
		.map(([path]) => path);
}

function seedPathsMatchCache(
	cached: Set<string>,
	currentMatches: string[],
): boolean {
	if (cached.size !== currentMatches.length) {
		return false;
	}
	for (const path of currentMatches) {
		if (!cached.has(path)) {
			return false;
		}
	}
	return true;
}

function expansionCacheKey(
	search: string,
	depth: number,
	seeds: Set<string>,
): string {
	return `${search}\0${depth}\0${[...seeds].sort().join("\n")}`;
}

/** Outgoing-only BFS on metadataCache.resolvedLinks. */
function expandOutgoing(
	app: App,
	seedPaths: string[],
	depth: number,
): Set<string> {
	const result = new Set<string>(seedPaths);
	let frontier = [...seedPaths];
	const links = app.metadataCache.resolvedLinks;

	for (let d = 0; d < depth; d++) {
		const next: string[] = [];
		for (const path of frontier) {
			const dests = links[path];
			if (!dests) continue;
			for (const dest of Object.keys(dests)) {
				if (!result.has(dest)) {
					result.add(dest);
					next.push(dest);
				}
			}
		}
		frontier = next;
	}

	return result;
}

export function clearExpansionCache(engine: GraphDataEngine): void {
	delete engine.__linkedNotesExpansionKey;
	delete engine.__linkedNotesExpanded;
}

/** Reuse BFS result until search, depth, or seeds change. */
export function getCachedExpansion(
	app: App,
	engine: GraphDataEngine,
	seedPaths: string[],
	depth: number,
): Set<string> {
	const search = getSearchQuery(engine);
	const seeds = new Set(seedPaths);
	const key = expansionCacheKey(search, depth, seeds);

	if (
		engine.__linkedNotesExpansionKey === key &&
		engine.__linkedNotesExpanded
	) {
		return engine.__linkedNotesExpanded;
	}

	const expanded = expandOutgoing(app, seedPaths, depth);
	engine.__linkedNotesExpansionKey = key;
	engine.__linkedNotesExpanded = expanded;
	return expanded;
}

/**
 * Cache search-only seeds when the query or match set changes. Call after prune
 * so fileFilter only contains search matches, not prior linked-note expansions.
 */
export function refreshSearchSeedCache(engine: GraphDataEngine): string[] {
	const search = getSearchQuery(engine);
	const currentMatches = collectSearchMatchPaths(engine);
	const cached = engine.__linkedNotesSeedPaths;

	if (
		search !== engine.__linkedNotesLastSearch ||
		!cached ||
		!seedPathsMatchCache(cached, currentMatches)
	) {
		engine.__linkedNotesSeedPaths = new Set(currentMatches);
		engine.__linkedNotesLastSearch = search;
		clearExpansionCache(engine);
	}

	return [...engine.__linkedNotesSeedPaths!];
}

/** Remove paths added by linked-notes expansion (plain `true`, not in seeds). */
export function pruneLinkedExpansions(
	engine: GraphDataEngine,
	seeds: Set<string>,
): void {
	for (const path of Object.keys(engine.fileFilter)) {
		if (engine.fileFilter[path] === true && !seeds.has(path)) {
			delete engine.fileFilter[path];
		}
	}
}

export function clearSearchSeedCache(engine: GraphDataEngine): void {
	delete engine.__linkedNotesSeedPaths;
	delete engine.__linkedNotesLastSearch;
	clearExpansionCache(engine);
}

export function mergeExpandedIntoFileFilter(
	engine: GraphDataEngine,
	expanded: Set<string>,
): void {
	for (const path of expanded) {
		if (!engine.fileFilter[path]) {
			engine.fileFilter[path] = true;
		}
	}
}
