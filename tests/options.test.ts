import { describe, expect, it } from "vitest";
import {
	GRAPH_SEARCH_DEPTH_KEY,
	GRAPH_SEARCH_INCLUDE_KEY,
} from "../src/graph/options/keys";
import {
	hasExplicitStoredKeys,
	readViewSettingsFromOptions,
	writeViewSettingsToOptions,
} from "../src/graph/options/readFromOptions";
import { resolveViewSettings } from "../src/graph/options/resolveSettings";
import { setEngineViewSettings } from "../src/graph/options/engineSettings";
import { DEFAULT_SETTINGS } from "../src/settings";
import { createMockApp, createMockEngine } from "./helpers/mockGraph";

describe("options read/write", () => {
	it("round-trips view settings through custom graph keys", () => {
		const blob: Record<string, unknown> = {};
		writeViewSettingsToOptions(blob, {
			includeLinkedNotes: true,
			linkDepth: 3,
		});

		expect(blob[GRAPH_SEARCH_INCLUDE_KEY]).toBe(true);
		expect(blob[GRAPH_SEARCH_DEPTH_KEY]).toBe(3);
		expect(
			readViewSettingsFromOptions(blob, DEFAULT_SETTINGS),
		).toEqual({ includeLinkedNotes: true, linkDepth: 3 });
	});

	it("uses defaults when stored keys are absent", () => {
		expect(hasExplicitStoredKeys({})).toBe(false);
		expect(readViewSettingsFromOptions({}, DEFAULT_SETTINGS)).toEqual(
			DEFAULT_SETTINGS,
		);
	});

	it("merges partial stored keys with defaults", () => {
		const partial = { [GRAPH_SEARCH_INCLUDE_KEY]: true };
		expect(hasExplicitStoredKeys(partial)).toBe(true);
		expect(readViewSettingsFromOptions(partial, DEFAULT_SETTINGS)).toEqual({
			includeLinkedNotes: true,
			linkDepth: DEFAULT_SETTINGS.linkDepth,
		});
	});
});

describe("resolveViewSettings", () => {
	const defaults = DEFAULT_SETTINGS;

	it("prefers graph plugin store in bookmark mode", () => {
		const app = createMockApp({}, { [GRAPH_SEARCH_INCLUDE_KEY]: true, [GRAPH_SEARCH_DEPTH_KEY]: 2 });
		const engine = createMockEngine();
		setEngineViewSettings(engine, { includeLinkedNotes: false, linkDepth: 1 });

		expect(resolveViewSettings(engine, app, defaults, "bookmark")).toEqual({
			includeLinkedNotes: true,
			linkDepth: 2,
		});
	});

	it("prefers engine memory in pane mode when set", () => {
		const app = createMockApp({}, { [GRAPH_SEARCH_INCLUDE_KEY]: true, [GRAPH_SEARCH_DEPTH_KEY]: 3 });
		const engine = createMockEngine();
		setEngineViewSettings(engine, { includeLinkedNotes: false, linkDepth: 1 });

		expect(resolveViewSettings(engine, app, defaults, "pane")).toEqual({
			includeLinkedNotes: false,
			linkDepth: 1,
		});
	});

	it("falls back to last setOptions payload when graph store lacks keys", () => {
		const engine = createMockEngine();
		engine.__linkedNotesLastSetOptionsPayload = {
			[GRAPH_SEARCH_INCLUDE_KEY]: true,
			[GRAPH_SEARCH_DEPTH_KEY]: 2,
		};

		expect(
			resolveViewSettings(engine, createMockApp(), defaults, "bookmark"),
		).toEqual({ includeLinkedNotes: true, linkDepth: 2 });
	});
});
