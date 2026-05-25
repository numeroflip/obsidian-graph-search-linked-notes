import { describe, expect, it, vi } from "vitest";
import { applyLinkedNotesPatch, removeLinkedNotesPatch } from "../src/graph/patch";
import { clearSearchSeedState } from "../src/graph/searchSeeds";
import {
	createMockApp,
	createMockEngine,
	createMockPlugin,
	withSearch,
} from "./helpers/mockGraph";

const LINKS = {
	"match.md": { "linked.md": 1 },
};

const DEPTH_LINKS = {
	"match.md": { "hop1.md": 1 },
	"hop1.md": { "hop2.md": 1 },
};

describe("applyLinkedNotesPatch", () => {
	it("does not expand when search is empty", () => {
		const origRender = vi.fn();
		const engine = createMockEngine({
			render: origRender,
			fileFilter: { "match.md": true },
		});
		const plugin = createMockPlugin(createMockApp(LINKS));

		applyLinkedNotesPatch(plugin, engine, () => ({
			enabled: true,
			depth: 1,
		}));
		engine.render();

		expect(engine.fileFilter["linked.md"]).toBeUndefined();
		expect(origRender).toHaveBeenCalledTimes(1);
	});

	it("does not expand while the search scan is running", () => {
		const origRender = vi.fn();
		const engine = withSearch(
			createMockEngine({
				render: origRender,
				fileFilter: { "match.md": true },
				queue: { runnable: { isRunning: () => true } },
			}),
			"tag:#x",
		);
		const plugin = createMockPlugin(createMockApp(LINKS));

		applyLinkedNotesPatch(plugin, engine, () => ({
			enabled: true,
			depth: 1,
		}));
		engine.render();

		expect(engine.fileFilter["linked.md"]).toBeUndefined();
		expect(origRender).toHaveBeenCalledTimes(1);
	});

	it("drops nodes beyond depth when depth decreases", () => {
		const origRender = vi.fn();
		const engine = withSearch(
			createMockEngine({
				render: origRender,
				fileFilter: { "match.md": true, "hop1.md": true, "hop2.md": true },
				__linkedNotesSeedPaths: new Set(["match.md"]),
				__linkedNotesExpanded: new Set(["match.md", "hop1.md", "hop2.md"]),
				__linkedNotesAddedPaths: new Set(["hop2.md"]),
			}),
			"tag:#x",
		);
		const plugin = createMockPlugin(createMockApp(DEPTH_LINKS));
		let depth = 2;

		applyLinkedNotesPatch(plugin, engine, () => ({
			enabled: true,
			depth,
		}));
		engine.render();
		expect(engine.fileFilter["hop2.md"]).toBe(true);

		depth = 1;
		engine.render();
		expect(engine.fileFilter["hop1.md"]).toBe(true);
		expect(engine.fileFilter["hop2.md"]).toBeUndefined();
	});

	it("merges outgoing linked notes when search is active and expansion enabled", () => {
		const origRender = vi.fn();
		const engine = withSearch(
			createMockEngine({
				render: origRender,
				fileFilter: { "match.md": true },
			}),
			"tag:#x",
		);
		const plugin = createMockPlugin(createMockApp(LINKS));

		applyLinkedNotesPatch(plugin, engine, () => ({
			enabled: true,
			depth: 1,
		}));
		engine.render();

		expect(engine.fileFilter["match.md"]).toBe(true);
		expect(engine.fileFilter["linked.md"]).toBe(true);
		expect(origRender).toHaveBeenCalledTimes(1);
	});

	it("does not strip new bookmark matches when seed cache is stale", () => {
		const origRender = vi.fn();
		const engine = withSearch(
			createMockEngine({
				render: origRender,
				fileFilter: { "b-match.md": true },
				__linkedNotesSeedPaths: new Set(["a-match.md"]),
				__linkedNotesExpanded: new Set(["a-match.md", "a-linked.md"]),
				__linkedNotesLastSearch: "tag:#old",
			}),
			"tag:#test",
		);
		const plugin = createMockPlugin(createMockApp(LINKS));

		applyLinkedNotesPatch(plugin, engine, () => ({
			enabled: true,
			depth: 1,
		}));
		engine.render();

		expect(engine.fileFilter["b-match.md"]).toBe(true);
		expect(origRender).toHaveBeenCalled();
	});

	it("removes added nodes immediately when disabled after bookmark seed clear", () => {
		const origRender = vi.fn();
		const engine = withSearch(
			createMockEngine({
				render: origRender,
				fileFilter: { "match.md": true, "linked.md": true },
				__linkedNotesAddedPaths: new Set(["linked.md"]),
			}),
			"tag:#x",
		);
		const plugin = createMockPlugin(createMockApp(LINKS));

		clearSearchSeedState(engine);
		applyLinkedNotesPatch(plugin, engine, () => ({
			enabled: false,
			depth: 1,
		}));
		engine.render();

		expect(engine.fileFilter["linked.md"]).toBeUndefined();
		expect(engine.fileFilter["match.md"]).toBe(true);
	});

	it("skips expansion when disabled even with an active search", () => {
		const origRender = vi.fn();
		const engine = withSearch(
			createMockEngine({
				render: origRender,
				fileFilter: { "match.md": true },
			}),
			"tag:#x",
		);
		const plugin = createMockPlugin(createMockApp(LINKS));

		applyLinkedNotesPatch(plugin, engine, () => ({
			enabled: false,
			depth: 1,
		}));
		engine.render();

		expect(engine.fileFilter["linked.md"]).toBeUndefined();
	});

	it("installs the patch only once", () => {
		const engine = withSearch(createMockEngine(), "q");
		const plugin = createMockPlugin(createMockApp());
		const getOptions = () => ({ enabled: false, depth: 1 });

		applyLinkedNotesPatch(plugin, engine, getOptions);
		const firstRender = engine.render;
		applyLinkedNotesPatch(plugin, engine, getOptions);

		expect(engine.render).toBe(firstRender);
	});
});

describe("removeLinkedNotesPatch", () => {
	it("restores original render and prunes expansions", () => {
		const origRender = vi.fn();
		const engine = withSearch(
			createMockEngine({
				render: origRender,
				fileFilter: { "match.md": true },
			}),
			"tag:#x",
		);
		const plugin = createMockPlugin(createMockApp(LINKS));

		applyLinkedNotesPatch(plugin, engine, () => ({
			enabled: true,
			depth: 1,
		}));
		engine.render();
		expect(engine.fileFilter["linked.md"]).toBe(true);
		expect(engine.__linkedNotesSeedPaths).toEqual(new Set(["match.md"]));
		expect(engine.__linkedNotesAddedPaths).toEqual(new Set(["linked.md"]));

		origRender.mockClear();
		removeLinkedNotesPatch(engine);

		expect(engine.fileFilter["linked.md"]).toBeUndefined();
		expect(engine.fileFilter["match.md"]).toBe(true);
		expect(engine.__linkedNotesPatched).toBeUndefined();
		expect(origRender).toHaveBeenCalledTimes(1);

		origRender.mockClear();
		engine.render();
		expect(origRender).toHaveBeenCalledTimes(1);
	});
});
