import { Setting, SliderComponent, ToggleComponent } from "obsidian";
import {
	clampLinkDepth,
	MAX_LINK_DEPTH,
	MIN_LINK_DEPTH,
	type PluginSettings,
} from "../settings";
import type { GraphDataEngine } from "./types";
import { getGraphSearchInput, hasActiveGraphSearch } from "./utils";

/** BEM class names — block: fgln (filtered graph linked notes) */
const FGLN_BLOCK = "fgln";
const FGLN_TOGGLE = `${FGLN_BLOCK}__toggle`;
const FGLN_DEPTH = `${FGLN_BLOCK}__depth`;
const FGLN_DEPTH_SLIDER = `${FGLN_BLOCK}__depth-slider`;
const FGLN_DEPTH_OFF = `${FGLN_DEPTH}--off`;

const FGLN_CONTROL_CLASSES = [FGLN_TOGGLE, FGLN_DEPTH].join(", ");
const SEARCH_DEBOUNCE_MS = 300;

export interface LinkedNotesControlState {
	includeLinkedNotes: boolean;
	linkDepth: number;
}

function findFilterSettingsContainer(controlsEl: HTMLElement): HTMLElement | null {
	return controlsEl.querySelector(
		".graph-control-section.mod-filter .tree-item-children",
	);
}

/**
 * Toggle to include linked notes + depth slider (1–3).
 * Both disabled when search is empty; depth disabled when toggle is off.
 */
export class LinkedNotesControlsSection {
	private readonly mountEl: HTMLElement;
	private readonly engine: GraphDataEngine;
	private includeToggle: ToggleComponent | null = null;
	private includeSetting: Setting | null = null;
	private depthSlider: SliderComponent | null = null;
	private depthSetting: Setting | null = null;
	private searchInput: HTMLInputElement | null = null;
	private searchClearBtn: HTMLElement | null = null;
	private controlsObserver: MutationObserver | null = null;
	private searchDebounceTimer: number | null = null;
	private suppressEmit = false;
	private readonly searchListeners: Array<{
		el: HTMLElement;
		type: string;
		handler: () => void;
	}> = [];

	constructor(
		mountEl: HTMLElement,
		engine: GraphDataEngine,
		initial: PluginSettings,
		private readonly onChange: (
			state: LinkedNotesControlState,
			rerunSearch?: boolean,
		) => void,
	) {
		this.mountEl = mountEl;
		this.engine = engine;

		this.includeSetting = new Setting(mountEl)
			.setName("Include linked notes")
			.setTooltip(
				"Show notes linked from filter matches, even if they do not match the search",
			)
			.setClass("mod-toggle")
			.addToggle((toggle) => {
				toggle
					.setValue(initial.includeLinkedNotes)
					.onChange(() => {
						this.syncDisabled();
						this.emitChange();
					});
				this.includeToggle = toggle;
			});
		this.includeSetting.settingEl.addClass(FGLN_TOGGLE);

		this.depthSetting = new Setting(mountEl)
			.setName("Depth")
			.setClass("mod-slider")
			.addSlider((slider) => {
				slider
					.setLimits(MIN_LINK_DEPTH, MAX_LINK_DEPTH, 1)
					.setValue(clampLinkDepth(initial.linkDepth))
					.setDynamicTooltip()
					.setInstant(true)
					.onChange(() => this.emitChange());
				slider.sliderEl.addClass(FGLN_DEPTH_SLIDER);
				this.depthSlider = slider;
			});
		this.depthSetting.settingEl.addClass(FGLN_DEPTH);

		this.bindSearchInput();
		this.syncDisabled();
		this.observeControlsEl();
	}

	/** Sync UI when this pane’s options were restored (e.g. bookmark). */
	updateFromSettings(settings: PluginSettings): void {
		this.suppressEmit = true;
		this.includeToggle?.setValue(settings.includeLinkedNotes);
		this.depthSlider?.setValue(clampLinkDepth(settings.linkDepth));
		this.syncDisabled();
		this.suppressEmit = false;
	}

	destroy(): void {
		this.controlsObserver?.disconnect();
		this.controlsObserver = null;

		if (this.searchDebounceTimer != null) {
			window.clearTimeout(this.searchDebounceTimer);
			this.searchDebounceTimer = null;
		}

		for (const { el, type, handler } of this.searchListeners) {
			el.removeEventListener(type, handler);
		}
		this.searchListeners.length = 0;

		this.includeSetting?.settingEl.remove();
		this.depthSetting?.settingEl.remove();
		this.includeSetting = null;
		this.depthSetting = null;
		this.includeToggle = null;
		this.depthSlider = null;
	}

	private observeControlsEl(): void {
		this.controlsObserver = new MutationObserver(() => {
			this.bindSearchInput();
			this.syncDisabled();
		});
		this.controlsObserver.observe(this.engine.controlsEl, {
			childList: true,
			subtree: true,
		});
	}

	private getState(): LinkedNotesControlState {
		return {
			includeLinkedNotes: this.includeToggle?.getValue() ?? false,
			linkDepth: clampLinkDepth(this.depthSlider?.getValue() ?? 1),
		};
	}

	private bindSearchInput(): void {
		const search = this.engine.filterOptions?.search;
		const input =
			search?.inputEl ?? getGraphSearchInput(this.engine) ?? null;
		if (!input || input === this.searchInput) {
			return;
		}

		this.searchInput = input;
		this.searchClearBtn = search?.clearButtonEl ?? null;

		const handler = () => {
			this.syncDisabled();
			if (this.searchDebounceTimer != null) {
				window.clearTimeout(this.searchDebounceTimer);
			}
			this.searchDebounceTimer = window.setTimeout(() => {
				this.searchDebounceTimer = null;
				this.emitChange(true);
			}, SEARCH_DEBOUNCE_MS);
		};

		for (const type of ["input", "change"] as const) {
			input.addEventListener(type, handler);
			this.searchListeners.push({ el: input, type, handler });
		}

		if (this.searchClearBtn) {
			const clearHandler = () => {
				if (this.searchDebounceTimer != null) {
					window.clearTimeout(this.searchDebounceTimer);
					this.searchDebounceTimer = null;
				}
				window.setTimeout(() => {
					this.syncDisabled();
					this.emitChange(true);
				}, 0);
			};
			this.searchClearBtn.addEventListener("click", clearHandler);
			this.searchListeners.push({
				el: this.searchClearBtn,
				type: "click",
				handler: clearHandler,
			});
		}
	}

	private syncDisabled(): void {
		const hasSearch = hasActiveGraphSearch(this.engine);
		const includeOn = this.includeToggle?.getValue() ?? false;
		const noSearch = !hasSearch;
		const depthOff = !includeOn;

		this.includeToggle?.setDisabled(noSearch);
		this.includeSetting?.setDisabled(noSearch);
		this.includeSetting?.settingEl.toggleClass("is-disabled", noSearch);

		const depthDisabled = noSearch || depthOff;
		this.depthSlider?.setDisabled(depthDisabled);
		this.depthSetting?.setDisabled(depthDisabled);
		this.depthSetting?.settingEl.toggleClass("is-disabled", depthDisabled);
		this.depthSetting?.settingEl.toggleClass(
			FGLN_DEPTH_OFF,
			!noSearch && depthOff,
		);

		if (noSearch) {
			this.includeSetting?.setTooltip(
				"Set a search filter above to include linked notes",
			);
			this.depthSetting?.setTooltip(
				"Set a search filter above to include linked notes",
			);
		} else if (!includeOn) {
			this.includeSetting?.setTooltip(
				"Show notes linked from filter matches, even if they do not match the search",
			);
			this.depthSetting?.setTooltip("Turn on Include linked notes to set depth");
		} else {
			const d = this.depthSlider?.getValue() ?? 1;
			this.includeSetting?.setTooltip(
				"Show notes linked from filter matches, even if they do not match the search",
			);
			this.depthSetting?.setTooltip(
				`Include notes up to ${d} outgoing link hop${d === 1 ? "" : "s"} from each match`,
			);
		}
	}

	private emitChange(rerunSearch = false): void {
		if (this.suppressEmit) {
			return;
		}
		this.onChange(this.getState(), rerunSearch);
	}
}

/** Remove plugin control rows from a graph filter panel (e.g. on plugin disable). */
export function removeLinkedNotesControls(engine: GraphDataEngine): void {
	const mountEl = findFilterSettingsContainer(engine.controlsEl);
	if (!mountEl) {
		return;
	}
	mountEl
		.querySelectorAll(FGLN_CONTROL_CLASSES)
		.forEach((el) => el.remove());
}

/** Append controls at the end of the native Filters list. */
export function mountLinkedNotesControls(
	engine: GraphDataEngine,
	initial: PluginSettings,
	onChange: (state: LinkedNotesControlState, rerunSearch?: boolean) => void,
): LinkedNotesControlsSection | null {
	const mountEl = findFilterSettingsContainer(engine.controlsEl);
	if (!mountEl) {
		console.warn(
			"[filtered-graph] Could not find .mod-filter .tree-item-children",
		);
		return null;
	}

	mountEl
		.querySelectorAll(FGLN_CONTROL_CLASSES)
		.forEach((el) => el.remove());

	return new LinkedNotesControlsSection(mountEl, engine, initial, onChange);
}
