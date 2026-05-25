import type { Plugin } from "obsidian";
import { clearExpansionCache, getCachedExpansion } from "./expansion";
import {
	mergeExpandedIntoFileFilter,
	pruneExpandedPaths,
} from "./fileFilter";
import { clearSearchSeedCache, refreshSearchSeedCache } from "./searchSeeds";
import { hasActiveGraphSearch, isSearchScanPending } from "./searchState";
import type { GraphDataEngine, LinkedNotesPatchOptions } from "./types";

export function applyLinkedNotesPatch(
	plugin: Plugin,
	engine: GraphDataEngine,
	getOptions: () => LinkedNotesPatchOptions,
): void {
	engine.__linkedNotesGetOptions = getOptions;

	if (engine.__linkedNotesPatched) {
		return;
	}

	const origRender = engine.render.bind(engine);
	engine.__linkedNotesOrigRender = origRender;
	engine.__linkedNotesPatched = true;

	engine.render = function patchedRender(this: GraphDataEngine) {
		if (!hasActiveGraphSearch(this)) {
			pruneExpandedPaths(this, this.__linkedNotesAddedPaths);
			clearSearchSeedCache(this);
			return origRender();
		}

		if (isSearchScanPending(this)) {
			return origRender();
		}

		const { enabled, depth } =
			this.__linkedNotesGetOptions?.() ?? { enabled: false, depth: 0 };

		pruneExpandedPaths(this, this.__linkedNotesAddedPaths);

		const seedPaths = refreshSearchSeedCache(this);

		if (!enabled || seedPaths.length === 0) {
			return origRender();
		}

		const expanded = getCachedExpansion(
			plugin.app,
			this,
			seedPaths,
			depth,
		);
		mergeExpandedIntoFileFilter(this, expanded);
		return origRender();
	};
}

export function removeLinkedNotesPatch(engine: GraphDataEngine): void {
	pruneExpandedPaths(engine, engine.__linkedNotesAddedPaths);

	const origRender = engine.__linkedNotesOrigRender;

	if (origRender) {
		engine.render = origRender;
		delete engine.__linkedNotesOrigRender;
	}
	delete engine.__linkedNotesPatched;
	delete engine.__linkedNotesGetOptions;
	clearSearchSeedCache(engine);

	if (origRender) {
		origRender.call(engine);
	} else if (typeof engine.render === "function") {
		engine.render();
	}
}
