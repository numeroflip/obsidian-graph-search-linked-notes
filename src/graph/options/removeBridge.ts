import type { GraphDataEngine } from "../types";

export function removeLinkedNotesOptionsBridge(engine: GraphDataEngine): void {
	const origGet = engine.__linkedNotesOrigGetOptions;
	const origSet = engine.__linkedNotesOrigSetOptions;

	if (origGet) {
		engine.getOptions = origGet;
	}
	if (origSet) {
		engine.setOptions = origSet;
	}

	delete engine.__linkedNotesOrigGetOptions;
	delete engine.__linkedNotesOrigSetOptions;
	delete engine.__linkedNotesOptionsBridged;
	delete engine.__linkedNotesViewSettings;
	delete engine.__linkedNotesLastSetOptionsPayload;
	delete engine.__linkedNotesSetOptionsSeq;
	delete engine.__linkedNotesSetOptionsCaptureInstalled;
}
