import { Plugin } from "obsidian";
import { GraphLinkedNotesManager } from "./graph/manager";
import {
	DEFAULT_SETTINGS,
	normalizePluginSettings,
	type PluginSettings,
} from "./settings";

export default class FilteredGraphLinkedNotesPlugin extends Plugin {
	settings: PluginSettings = { ...DEFAULT_SETTINGS };
	private graphManager: GraphLinkedNotesManager | null = null;

	async onload() {
		await this.loadSettings();

		this.graphManager = new GraphLinkedNotesManager(
			this,
			() => this.settings,
			(s) => this.saveSettings(s),
		);

		this.registerEvent(
			this.app.workspace.on("layout-change", () => this.graphManager?.sync()),
		);

		this.app.workspace.onLayoutReady(() => this.graphManager?.sync());
	}

	onunload() {
		this.graphManager?.destroy();
		this.graphManager = null;
	}

	async loadSettings() {
		const data = (await this.loadData()) as Parameters<
			typeof normalizePluginSettings
		>[0];
		this.settings = normalizePluginSettings(data);
	}

	async saveSettings(settings: PluginSettings = this.settings) {
		this.settings = settings;
		await this.saveData(this.settings);
	}
}
