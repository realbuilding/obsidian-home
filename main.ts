import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, EMPTY_VIEW_TYPE, ObsidianHomeSettings, VIEW_TYPE_HOME } from "./types";
import { ObsidianHomeView } from "./homeView";
import { ObsidianHomeSettingTab } from "./settingsTab";

const REFRESH_DEBOUNCE_MS = 800;

export default class ObsidianHomePlugin extends Plugin {
	settings: ObsidianHomeSettings = DEFAULT_SETTINGS;
	private homeViews = new Set<ObsidianHomeView>();
	private refreshTimer: number | null = null;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ObsidianHomeSettingTab(this.app, this));

		this.registerView(VIEW_TYPE_HOME, (leaf) => new ObsidianHomeView(leaf, this));

		this.app.workspace.onLayoutReady(() => this.convertEmptyLeaves());
		this.registerEvent(this.app.workspace.on("layout-change", () => this.convertEmptyLeaves()));
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.convertEmptyLeaves()));

		this.registerEvent(this.app.vault.on("create", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("modify", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("delete", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("rename", () => this.scheduleRefresh()));
	}

	onunload() {
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

	refreshAllHomeViews() {
		this.homeViews.forEach((view) => void view.render());
	}

	private scheduleRefresh() {
		if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			this.refreshAllHomeViews();
		}, REFRESH_DEBOUNCE_MS);
	}

	// Convert Obsidian's built-in "empty" (new tab) leaves into our own view type,
	// same technique mirnovov/obsidian-homepage uses: once converted, a leaf no
	// longer matches "empty" so this never reconverts the same leaf twice.
	private convertEmptyLeaves() {
		this.app.workspace.getLeavesOfType(EMPTY_VIEW_TYPE).forEach((leaf) => {
			void leaf.setViewState({ type: VIEW_TYPE_HOME, state: {} });
		});
	}
}
