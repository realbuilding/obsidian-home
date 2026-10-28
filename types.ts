export type SortKey = "ctime" | "mtime";

export interface ObsidianHomeSettings {
	sortBy: SortKey;
	limit: number;
	previewLines: number;
	pinnedPaths: string[];
	// Recent files: empty include list means the whole vault; excludes apply afterwards.
	recentIncludeFolders: string[];
	recentExcludeFolders: string[];
	openOnMobileStartup: boolean;
	// Frontmatter properties that override file ctime/mtime; empty means use file stat.
	createdProperty: string;
	updatedProperty: string;
	wanderEnabled: boolean;
	wanderFolders: string[];
	wanderCount: number;
	// Current wander picks; persisted so they only change on manual shuffle.
	wanderPaths: string[];
	// One-tap search terms shown in the new-note folder picker.
	newNoteQuickTerms: string[];
}

export const DEFAULT_SETTINGS: ObsidianHomeSettings = {
	sortBy: "ctime",
	limit: 20,
	previewLines: 2,
	pinnedPaths: [],
	recentIncludeFolders: [],
	recentExcludeFolders: [],
	openOnMobileStartup: true,
	createdProperty: "created",
	updatedProperty: "updated",
	wanderEnabled: false,
	wanderFolders: [],
	wanderCount: 2,
	wanderPaths: [],
	newNoteQuickTerms: [],
};

export const VIEW_TYPE_HOME = "obsidian-home-view";
export const EMPTY_VIEW_TYPE = "empty";

// Encrypted notes (e.g. Meld Encrypt) can be pinned; their content is never read for previews.
export const ENCRYPTED_EXTENSION = "mdenc";
