export type SortKey = "ctime" | "mtime";

export interface ObsidianHomeSettings {
	sortBy: SortKey;
	limit: number;
	previewLines: number;
	pinnedPaths: string[];
}

export const DEFAULT_SETTINGS: ObsidianHomeSettings = {
	sortBy: "ctime",
	limit: 20,
	previewLines: 2,
	pinnedPaths: [],
};

export const VIEW_TYPE_HOME = "obsidian-home-view";
export const EMPTY_VIEW_TYPE = "empty";
