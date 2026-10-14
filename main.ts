import { Platform, Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, EMPTY_VIEW_TYPE, ObsidianHomeSettings, VIEW_TYPE_HOME } from "./types";
import { ObsidianHomeView } from "./homeView";
import { ObsidianHomeSettingTab } from "./settingsTab";
import { NutstoreSyncWatcher } from "./syncStatus";

const REFRESH_DEBOUNCE_MS = 800;
// Mobile only: opening a new tab closes the least recently used ones beyond this count.
const MOBILE_MAX_TABS = 6;
// Hides the restored note while the app boots, so the startup home view
// replaces it without first flashing the previous page.
const BOOTING_CLASS = "oh-booting";

export default class ObsidianHomePlugin extends Plugin {
	settings: ObsidianHomeSettings = DEFAULT_SETTINGS;
	private homeViews = new Set<ObsidianHomeView>();
	private refreshTimer: number | null = null;
	syncWatcher = new NutstoreSyncWatcher(this.app, () => this.scheduleRefresh());

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ObsidianHomeSettingTab(this.app, this));

		this.registerView(VIEW_TYPE_HOME, (leaf) => new ObsidianHomeView(leaf, this));

		const openOnStartup = Platform.isMobile && this.settings.openOnMobileStartup;
		if (openOnStartup) document.body.addClass(BOOTING_CLASS);

		this.app.workspace.onLayoutReady(async () => {
			this.dedupeRestoredHomes();
			this.convertEmptyLeaves();
			this.syncWatcher.start();
			if (!openOnStartup) return;
			try {
				await this.openHome();
			} finally {
				document.body.removeClass(BOOTING_CLASS);
			}
		});
		this.registerEvent(this.app.workspace.on("layout-change", () => this.convertEmptyLeaves()));
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.convertEmptyLeaves()));

		this.registerEvent(this.app.vault.on("create", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("modify", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("delete", () => this.scheduleRefresh()));
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				this.remapSavedPaths(oldPath, file.path);
				this.scheduleRefresh();
			})
		);
		// Frontmatter dates may only become available once the metadata cache resolves.
		this.registerEvent(this.app.metadataCache.on("resolved", () => this.scheduleRefresh()));
	}

	onunload() {
		document.body.removeClass(BOOTING_CLASS);
		this.syncWatcher.stop();
		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	registerHomeView(view: ObsidianHomeView) {
		this.homeViews.add(view);
	}

	unregisterHomeView(view: ObsidianHomeView) {
		this.homeViews.delete(view);
	}

	// Keep a single home tab: whichever home opens last wins and the others are
	// closed. Skipped while the workspace restores (several restored homes would
	// close each other); dedupeRestoredHomes() handles that once layout is ready.
	claimHome(leaf: WorkspaceLeaf) {
		if (!this.app.workspace.layoutReady) return;
		this.app.workspace.getLeavesOfType(VIEW_TYPE_HOME).forEach((other) => {
			if (other !== leaf) other.detach();
		});
	}

	// Prefer the home the user is looking at, otherwise keep the first one.
	private dedupeRestoredHomes() {
		const { workspace } = this.app;
		const homes = workspace.getLeavesOfType(VIEW_TYPE_HOME);
		const active = workspace.getMostRecentLeaf();
		const keep = homes.find((leaf) => leaf === active) ?? homes[0];
		if (keep) this.claimHome(keep);
	}

	refreshAllHomeViews() {
		this.homeViews.forEach((view) => void view.render());
	}

	// Follow renames/moves so saved pins, wander folders and picks aren't dropped.
	private remapSavedPaths(oldPath: string, newPath: string) {
		const remap = (p: string) =>
			p === oldPath ? newPath : p.startsWith(`${oldPath}/`) ? newPath + p.slice(oldPath.length) : p;
		const s = this.settings;
		const before = JSON.stringify([s.pinnedPaths, s.wanderFolders, s.wanderPaths]);
		s.pinnedPaths = s.pinnedPaths.map(remap);
		s.wanderFolders = s.wanderFolders.map(remap);
		s.wanderPaths = s.wanderPaths.map(remap);
		if (JSON.stringify([s.pinnedPaths, s.wanderFolders, s.wanderPaths]) !== before) void this.saveSettings();
	}

	private scheduleRefresh() {
		if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			this.refreshAllHomeViews();
		}, REFRESH_DEBOUNCE_MS);
	}

	// Reveal an existing home tab if one was restored, otherwise reuse the active
	// tab (the previous note stays in its back history) instead of opening a new
	// one, so repeated launches don't pile up tabs and the restored note stops loading.
	private async openHome() {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_HOME)[0];
		if (existing) {
			workspace.setActiveLeaf(existing, { focus: true });
			return;
		}
		const leaf = workspace.getLeaf(false);
		await leaf.setViewState({ type: VIEW_TYPE_HOME, state: {} });
		workspace.setActiveLeaf(leaf, { focus: true });
	}

	// Convert Obsidian's built-in "empty" (new tab) leaves into our own view type,
	// same technique mirnovov/obsidian-homepage uses: once converted, a leaf no
	// longer matches "empty" so this never reconverts the same leaf twice.
	private convertEmptyLeaves() {
		this.app.workspace.getLeavesOfType(EMPTY_VIEW_TYPE).forEach(async (leaf) => {
			await leaf.setViewState({ type: VIEW_TYPE_HOME, state: {} });
			if (!Platform.isMobile || !this.app.workspace.layoutReady) return;
			// Wait until the home view has painted so closing tabs never delays it.
			window.requestAnimationFrame(() => window.setTimeout(() => this.trimMobileTabs(leaf), 0));
		});
	}

	// Close the least recently used tabs so at most MOBILE_MAX_TABS stay open,
	// counting the new one. Pinned tabs are never closed. activeTime is not part
	// of the public typings, so missing values sort as oldest.
	private trimMobileTabs(keep: WorkspaceLeaf) {
		const leaves: WorkspaceLeaf[] = [];
		this.app.workspace.iterateRootLeaves((leaf) => {
			leaves.push(leaf);
		});
		let excess = leaves.length - MOBILE_MAX_TABS;
		if (excess <= 0) return;
		const activeTime = (leaf: WorkspaceLeaf) => (leaf as unknown as { activeTime?: number }).activeTime ?? 0;
		leaves
			.filter((leaf) => leaf !== keep && !leaf.getViewState().pinned)
			.sort((a, b) => activeTime(a) - activeTime(b))
			.forEach((leaf) => {
				if (excess-- > 0) leaf.detach();
			});
	}
}
