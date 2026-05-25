import type { FglnDebugSettings } from "../debug/log";
import type { GraphDataEngine } from "../types";
import { rememberSetOptionsPayload } from "./rememberPayload";

/** Record setOptions payloads before the full bridge exists (bookmark restore vs onload race). */
export function ensureSetOptionsCapture(
	engine: GraphDataEngine,
	debug?: FglnDebugSettings,
): void {
	if (engine.__linkedNotesSetOptionsCaptureInstalled) {
		return;
	}
	if (typeof engine.setOptions !== "function") {
		return;
	}

	const origSet = engine.setOptions.bind(engine);
	engine.__linkedNotesSetOptionsCaptureInstalled = true;
	engine.setOptions = function capturedSetOptions(
		this: GraphDataEngine,
		options: Record<string, unknown>,
	) {
		if (options) {
			rememberSetOptionsPayload(this, options, debug, "capture");
		}
		return origSet.call(this, options);
	};
}
