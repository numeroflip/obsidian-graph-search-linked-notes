import type { GraphDataEngine } from "./types";

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
