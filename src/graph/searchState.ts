import { getGraphSearchInput } from "./searchInput";
import type { GraphDataEngine } from "./types";

/** Same source as the graph engine's updateSearch() (filterOptions.search.getValue). */
export function getSearchQuery(engine: GraphDataEngine): string {
	const fromApi = engine.filterOptions?.search?.getValue?.()?.trim();
	if (fromApi) {
		return fromApi;
	}
	return getGraphSearchInput(engine)?.value.trim() ?? "";
}

/** True only while the vault scan is actively running (not merely queue assigned). */
export function isSearchScanPending(engine: GraphDataEngine): boolean {
	return engine.queue?.runnable?.isRunning() ?? false;
}

export function hasActiveGraphSearch(engine: GraphDataEngine): boolean {
	return getSearchQuery(engine).length > 0;
}
