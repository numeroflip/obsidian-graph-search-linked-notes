import type { GraphDataEngine } from "./types";

export function getGraphSearchInput(
	engine: GraphDataEngine,
): HTMLInputElement | null {
	const search = engine.filterOptions?.search;
	if (search?.inputEl) {
		return search.inputEl;
	}
	return engine.controlsEl.querySelector(
		'.graph-control-section.mod-filter input[type="search"], .graph-control-section.mod-filter input[type="text"]',
	);
}
