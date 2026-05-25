import type { App } from "obsidian";
import type { PluginSettings, ViewSettings } from "../settings";

const LOG_PREFIX = "[filtered-graph]";

export interface FglnDebugSettings {
	debugLogging?: boolean;
}

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

export function summarizeViewSettings(settings: ViewSettings): string {
	return `include=${settings.includeLinkedNotes} depth=${settings.linkDepth}`;
}

export function summarizeOptionsFgln(
	options: Record<string, unknown> | null | undefined,
): string {
	if (!options) {
		return "fgln=(none)";
	}
	const include = options.fglnIncludeLinkedNotes;
	const depth = options.fglnLinkDepth;
	const parts: string[] = [];
	if (typeof include === "boolean") {
		parts.push(`include=${include}`);
	}
	if (typeof depth === "number") {
		parts.push(`depth=${depth}`);
	}
	return parts.length > 0 ? parts.join(" ") : "fgln=(absent)";
}

export function getGraphPluginOptionsBlob(
	app: App,
): Record<string, unknown> | null {
	const internalPlugins = (
		app as App & {
			internalPlugins?: {
				getPluginById(id: string): { instance?: unknown } | null;
			};
		}
	).internalPlugins;
	const inst = internalPlugins?.getPluginById("graph")?.instance as
		| { options?: Record<string, unknown> & { options?: Record<string, unknown> } }
		| undefined;
	if (!inst?.options) {
		return null;
	}
	const root = inst.options;
	if (
		root.options &&
		typeof root.options === "object" &&
		!Array.isArray(root.options)
	) {
		return root.options as Record<string, unknown>;
	}
	return root;
}
