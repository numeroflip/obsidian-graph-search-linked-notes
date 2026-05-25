import { describe, expect, it } from "vitest";
import { clearExpansionCache, getCachedExpansion } from "../src/graph/expansion";
import { createMockApp, createMockEngine } from "./helpers/mockGraph";

const LINKS = {
	"seed.md": { "hop1.md": 1 },
	"hop1.md": { "hop2.md": 1 },
};

describe("getCachedExpansion", () => {
	it("includes seeds and direct outgoing links at depth 1", () => {
		const app = createMockApp(LINKS);
		const engine = createMockEngine();
		const expanded = getCachedExpansion(app, engine, ["seed.md"], 1);

		expect([...expanded].sort()).toEqual(["hop1.md", "seed.md"]);
	});

	it("walks multiple hops up to depth", () => {
		const app = createMockApp(LINKS);
		const engine = createMockEngine();

		expect([...getCachedExpansion(app, engine, ["seed.md"], 2)].sort()).toEqual(
			["hop1.md", "hop2.md", "seed.md"],
		);
		expect([...getCachedExpansion(app, engine, ["seed.md"], 3)].sort()).toEqual(
			["hop1.md", "hop2.md", "seed.md"],
		);
	});

	it("prunes prior linked nodes before clearing cache (depth decrease)", () => {
		const engine = createMockEngine({
			fileFilter: { "seed.md": true, "hop1.md": true, "hop2.md": true },
			__linkedNotesSeedPaths: new Set(["seed.md"]),
			__linkedNotesExpanded: new Set(["seed.md", "hop1.md", "hop2.md"]),
			__linkedNotesAddedPaths: new Set(["hop2.md"]),
		});

		clearExpansionCache(engine);

		expect(engine.fileFilter["seed.md"]).toBe(true);
		expect(engine.fileFilter["hop1.md"]).toBeUndefined();
		expect(engine.fileFilter["hop2.md"]).toBeUndefined();
	});

	it("reuses cache until search, depth, or seeds change", () => {
		const app = createMockApp(LINKS);
		const engine = createMockEngine();
		engine.filterOptions = {
			search: { getValue: () => "tag:#a", inputEl: {} as HTMLInputElement },
		};

		const first = getCachedExpansion(app, engine, ["seed.md"], 1);
		const second = getCachedExpansion(app, engine, ["seed.md"], 1);
		expect(second).toBe(first);

		engine.filterOptions.search!.getValue = () => "tag:#b";
		clearExpansionCache(engine);
		const afterSearch = getCachedExpansion(app, engine, ["seed.md"], 1);
		expect(afterSearch).not.toBe(first);
	});
});
