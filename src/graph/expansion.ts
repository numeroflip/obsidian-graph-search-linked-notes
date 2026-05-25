import type { App } from "obsidian";
import { getSearchQuery } from "./searchState";
import type { GraphDataEngine } from "./types";

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
	delete engine.__linkedNotesAddedPaths;
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
