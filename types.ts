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
	wanderEnabled: boolean;
	wanderFolders: string[];
	wanderCount: number;
	// Current wander picks; persisted so they only change on manual shuffle.
	wanderPaths: string[];
}

export const DEFAULT_SETTINGS: ObsidianHomeSettings = {
	sortBy: "ctime",
	limit: 20,
	previewLines: 2,
	pinnedPaths: [],
	openOnMobileStartup: true,
	createdProperty: "created",
	updatedProperty: "updated",
	wanderEnabled: false,
	wanderFolders: [],
	wanderCount: 2,
	wanderPaths: [],
};

export const VIEW_TYPE_HOME = "obsidian-home-view";
export const EMPTY_VIEW_TYPE = "empty";
