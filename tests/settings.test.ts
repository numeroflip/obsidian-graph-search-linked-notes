import { describe, expect, it } from "vitest";
import { clampLinkDepth, DEFAULT_SETTINGS } from "../src/settings";
import { normalizePluginSettings } from "../src/settings/normalize";

describe("clampLinkDepth", () => {
	it("clamps to 1–3", () => {
		expect(clampLinkDepth(0)).toBe(1);
		expect(clampLinkDepth(2.4)).toBe(2);
		expect(clampLinkDepth(99)).toBe(3);
	});
});

describe("normalizePluginSettings", () => {
	it("returns defaults for missing data", () => {
		expect(normalizePluginSettings(null)).toEqual(DEFAULT_SETTINGS);
	});

	it("migrates legacy linkedNotesDepth", () => {
		expect(normalizePluginSettings({ linkedNotesDepth: 2 })).toEqual({
			includeLinkedNotes: true,
			linkDepth: 2,
		});
		expect(normalizePluginSettings({ linkedNotesDepth: 0 })).toEqual({
			includeLinkedNotes: false,
			linkDepth: DEFAULT_SETTINGS.linkDepth,
		});
	});
});
