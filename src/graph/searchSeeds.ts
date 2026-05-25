import { clearExpansionCache } from "./expansion";
import { getSearchQuery } from "./searchState";
import type { GraphDataEngine } from "./types";

function isSearchFilterMatch(value: boolean | object): boolean {
	return value === true || (typeof value === "object" && value !== null);
}

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

export function clearSearchSeedCache(engine: GraphDataEngine): void {
	delete engine.__linkedNotesSeedPaths;
	delete engine.__linkedNotesLastSearch;
	clearExpansionCache(engine);
}
