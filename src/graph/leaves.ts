import type { App, WorkspaceLeaf } from "obsidian";
import type { GraphViewInternal } from "./types";
import { GLOBAL_GRAPH_VIEW_TYPE } from "./types";

export function isGraphView(view: unknown): view is GraphViewInternal {
	if (!view || typeof view !== "object") return false;
	const v = view as GraphViewInternal;
	return (
		typeof v.getViewType === "function" &&
		v.getViewType() === GLOBAL_GRAPH_VIEW_TYPE &&
		v.dataEngine != null
	);
}

export function findGraphLeaves(app: App): WorkspaceLeaf[] {
	return app.workspace.getLeavesOfType(GLOBAL_GRAPH_VIEW_TYPE);
}
