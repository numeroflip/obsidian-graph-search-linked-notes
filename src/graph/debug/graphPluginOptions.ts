import type { App } from "obsidian";

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
		return root.options;
	}
	return root;
}
