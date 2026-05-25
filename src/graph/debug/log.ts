import type { PluginSettings } from "../../settings";

const LOG_PREFIX = "[graph-search-linked-notes]";

export type PluginDebugSettings = Pick<PluginSettings, "debugLogging">;

export function pluginDebugLog(
	settings: PluginDebugSettings,
	event: string,
	data?: Record<string, unknown>,
): void {
	if (!settings.debugLogging) {
		return;
	}
	const time = new Date().toISOString().slice(11, 23);
	if (data === undefined) {
		console.debug(`${LOG_PREFIX} ${time} ${event}`);
		return;
	}
	console.debug(`${LOG_PREFIX} ${time} ${event}`, data);
}
