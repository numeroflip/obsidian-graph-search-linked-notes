import type { GraphDataEngine } from "./types";

/** Remove paths previously added by linked-notes expansion. */
export function pruneExpandedPaths(
	engine: GraphDataEngine,
	expanded: Set<string> | undefined,
): void {
	if (!expanded?.size) {
		return;
	}
	for (const path of expanded) {
		if (engine.fileFilter[path] === true) {
			delete engine.fileFilter[path];
		}
	}
}

/**
 * Remove every linked-note path merged into fileFilter, not only the last batch.
 * Uses the cached BFS result when available so depth decreases fully shrink the graph.
 */
export function pruneAllLinkedExpansions(engine: GraphDataEngine): void {
	const expanded = engine.__linkedNotesExpanded;
	const seeds = engine.__linkedNotesSeedPaths;
	if (expanded && seeds) {
		const linkedOnly = new Set<string>();
		for (const path of expanded) {
			if (!seeds.has(path)) {
				linkedOnly.add(path);
			}
		}
		pruneExpandedPaths(engine, linkedOnly);
		return;
	}
	pruneExpandedPaths(engine, engine.__linkedNotesAddedPaths);
}

/**
 * Legacy prune by seed complement. Only safe when seeds match the current search;
 * prefer {@link pruneExpandedPaths} when expansion cache is available.
 */
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

export function mergeExpandedIntoFileFilter(
	engine: GraphDataEngine,
	expanded: Set<string>,
): void {
	const added = new Set<string>();
	for (const path of expanded) {
		if (!engine.fileFilter[path]) {
			engine.fileFilter[path] = true;
			added.add(path);
		}
	}
	engine.__linkedNotesAddedPaths = added;
}
