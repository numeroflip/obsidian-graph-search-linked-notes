import { describe, expect, it } from "vitest";
import {
	clearSearchSeedCache,
	clearSearchSeedState,
	refreshSearchSeedCache,
} from "../src/graph/searchSeeds";
import { createMockEngine, withSearch } from "./helpers/mockGraph";

describe("refreshSearchSeedCache", () => {
	it("collects search matches (true or object) as seeds", () => {
		const engine = withSearch(
			createMockEngine({
				fileFilter: {
					"a.md": true,
					"b.md": { match: true },
					"c.md": false as unknown as boolean,
				},
			}),
			"tag:#x",
		);

		const seeds = refreshSearchSeedCache(engine);

		expect(seeds.sort()).toEqual(["a.md", "b.md"]);
		expect(engine.__linkedNotesSeedPaths).toEqual(new Set(["a.md", "b.md"]));
	});

	it("invalidates expansion cache when the query changes", () => {
		const engine = withSearch(
			createMockEngine({
				fileFilter: { "a.md": true },
				__linkedNotesExpansionKey: "stale",
				__linkedNotesExpanded: new Set(["a.md"]),
			}),
			"tag:#one",
		);

		refreshSearchSeedCache(engine);
		engine.filterOptions.search!.getValue = () => "tag:#two";
		refreshSearchSeedCache(engine);

		expect(engine.__linkedNotesExpansionKey).toBeUndefined();
		expect(engine.__linkedNotesExpanded).toBeUndefined();
	});

	it("clearSearchSeedState drops seeds but keeps added paths for prune", () => {
		const engine = createMockEngine({
			__linkedNotesSeedPaths: new Set(["a.md"]),
			__linkedNotesLastSearch: "q",
			__linkedNotesAddedPaths: new Set(["linked.md"]),
		});

		clearSearchSeedState(engine);

		expect(engine.__linkedNotesSeedPaths).toBeUndefined();
		expect(engine.__linkedNotesLastSearch).toBeUndefined();
		expect(engine.__linkedNotesAddedPaths).toEqual(new Set(["linked.md"]));
	});

	it("clearSearchSeedCache drops seed and expansion state", () => {
		const engine = createMockEngine({
			__linkedNotesSeedPaths: new Set(["a.md"]),
			__linkedNotesLastSearch: "q",
			__linkedNotesExpansionKey: "k",
			__linkedNotesExpanded: new Set(["a.md"]),
		});

		clearSearchSeedCache(engine);

		expect(engine.__linkedNotesSeedPaths).toBeUndefined();
		expect(engine.__linkedNotesLastSearch).toBeUndefined();
		expect(engine.__linkedNotesExpansionKey).toBeUndefined();
	});
});
