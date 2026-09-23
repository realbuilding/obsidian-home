export type SortKey = "ctime" | "mtime";

export interface ObsidianHomeSettings {
	sortBy: SortKey;
	limit: number;
	previewLines: number;
	pinnedPaths: string[];
	openOnMobileStartup: boolean;
	// Frontmatter properties that override file ctime/mtime; empty means use file stat.
	createdProperty: string;
	updatedProperty: string;
}

export const DEFAULT_SETTINGS: ObsidianHomeSettings = {
	sortBy: "ctime",
	limit: 20,
	previewLines: 2,
	pinnedPaths: [],
	openOnMobileStartup: true,
	createdProperty: "created",
	updatedProperty: "updated",
};

export const VIEW_TYPE_HOME = "obsidian-home-view";
export const EMPTY_VIEW_TYPE = "empty";
