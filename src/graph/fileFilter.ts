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
