import type { Plugin } from "obsidian";
import type { GraphDataEngine, LinkedNotesPatchOptions } from "./types";
import {
	clearSearchSeedCache,
	getCachedExpansion,
	hasActiveGraphSearch,
	isSearchScanPending,
	mergeExpandedIntoFileFilter,
	pruneLinkedExpansions,
	refreshSearchSeedCache,
} from "./utils";

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
			if (this.__linkedNotesSeedPaths) {
				pruneLinkedExpansions(this, this.__linkedNotesSeedPaths);
			}
			clearSearchSeedCache(this);
			return origRender();
		}

		// setQuery fills fileFilter asynchronously; skip until the scan finishes.
		if (isSearchScanPending(this)) {
			return origRender();
		}

		const { enabled, depth } =
			this.__linkedNotesGetOptions?.() ?? { enabled: false, depth: 0 };

		const seedSet = this.__linkedNotesSeedPaths;
		if (seedSet) {
			pruneLinkedExpansions(this, seedSet);
		}

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
	const seeds = engine.__linkedNotesSeedPaths;
	if (seeds) {
		pruneLinkedExpansions(engine, seeds);
	}

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
