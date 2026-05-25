import { describe, expect, it } from "vitest";
import {
	mergeExpandedIntoFileFilter,
	pruneExpandedPaths,
	pruneLinkedExpansions,
} from "../src/graph/fileFilter";
import { createMockEngine } from "./helpers/mockGraph";

describe("fileFilter helpers", () => {
	it("pruneExpandedPaths removes only known expansion paths", () => {
		const engine = createMockEngine({
			fileFilter: {
				"match.md": true,
				"linked.md": true,
				"other.md": { highlight: true },
			},
		});

		pruneExpandedPaths(engine, new Set(["linked.md"]));

		expect(engine.fileFilter).toEqual({
			"match.md": true,
			"other.md": { highlight: true },
		});
	});

	it("prune removes plain true entries not in the seed set", () => {
		const engine = createMockEngine({
			fileFilter: {
				"match.md": true,
				"expanded.md": true,
				"other-match.md": { highlight: true },
			},
		});
		const seeds = new Set(["match.md", "other-match.md"]);

		pruneLinkedExpansions(engine, seeds);

		expect(engine.fileFilter).toEqual({
			"match.md": true,
			"other-match.md": { highlight: true },
		});
		expect(engine.fileFilter["expanded.md"]).toBeUndefined();
	});

	it("merge adds expanded paths without overwriting existing entries", () => {
		const engine = createMockEngine({
			fileFilter: {
				"match.md": { highlight: true },
			},
		});

		mergeExpandedIntoFileFilter(
			engine,
			new Set(["match.md", "neighbor.md"]),
		);

		expect(engine.fileFilter["match.md"]).toEqual({ highlight: true });
		expect(engine.fileFilter["neighbor.md"]).toBe(true);
		expect(engine.__linkedNotesAddedPaths).toEqual(new Set(["neighbor.md"]));
	});
});
