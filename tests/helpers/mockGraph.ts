import type { App, Plugin } from "obsidian";
import type { GraphDataEngine } from "../../src/graph/types";

export type ResolvedLinks = Record<string, Record<string, number>>;

export function createMockApp(
	resolvedLinks: ResolvedLinks = {},
	graphOptionsBlob: Record<string, unknown> | null = null,
): App {
	const graphInstance =
		graphOptionsBlob != null
			? { options: { options: graphOptionsBlob } }
			: null;

	return {
		metadataCache: { resolvedLinks },
		internalPlugins: {
			getPluginById: (id: string) =>
				id === "graph" ? { instance: graphInstance } : null,
		},
	} as unknown as App;
}

export function createMockPlugin(app: App): Plugin {
	return { app } as Plugin;
}

export function createMockEngine(
	overrides: Partial<GraphDataEngine> = {},
): GraphDataEngine {
	const render = overrides.render ?? (() => undefined);

	return {
		app: createMockApp(),
		controlsEl: {
			querySelector: () => null,
		} as unknown as HTMLElement,
		fileFilter: {},
		queue: null,
		filterOptions: {},
		render,
		updateSearch: () => undefined,
		...overrides,
	} as GraphDataEngine;
}

export function withSearch(
	engine: GraphDataEngine,
	query: string,
): GraphDataEngine {
	engine.filterOptions = {
		search: {
			getValue: () => query,
			inputEl: {} as HTMLInputElement,
		},
	};
	return engine;
}
