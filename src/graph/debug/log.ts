import type { PluginSettings } from "../../settings";

const LOG_PREFIX = "[filtered-graph]";

export type FglnDebugSettings = Pick<PluginSettings, "debugLogging">;

export function fglnDebugLog(
	settings: FglnDebugSettings,
	event: string,
	data?: Record<string, unknown>,
): void {
	if (!settings.debugLogging) {
		return;
	}
	const time = new Date().toISOString().slice(11, 23);
	if (data === undefined) {
		console.log(`${LOG_PREFIX} ${time} ${event}`);
		return;
	}
	console.log(`${LOG_PREFIX} ${time} ${event}`, data);
}
