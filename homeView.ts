import { ItemView, Menu, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type ObsidianHomePlugin from "./main";
import { VIEW_TYPE_HOME } from "./types";
import { formatTime, loadPreview, parseDateProperty } from "./previewUtils";

// Picks up to `count` distinct items via a partial Fisher-Yates shuffle.
function pickRandom<T>(items: T[], count: number): T[] {
	const pool = items.slice();
	const n = Math.min(count, pool.length);
	for (let i = 0; i < n; i++) {
		const j = i + Math.floor(Math.random() * (pool.length - i));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	return pool.slice(0, n);
}

export class ObsidianHomeView extends ItemView {
	private plugin: ObsidianHomePlugin;

	constructor(leaf: WorkspaceLeaf, plugin: ObsidianHomePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_HOME;
	}

	getDisplayText(): string {
		return "ObsidianHome";
	}

	getIcon(): string {
		return "home";
	}

	async onOpen() {
		this.plugin.registerHomeView(this);
		this.contentEl.addClass("oh-root");
		await this.render();
	}

	async onClose() {
		this.plugin.unregisterHomeView(this);
	}

	async render() {
		const container = this.contentEl;
		container.empty();

		this.renderHeader(container);

		const scroll = container.createDiv({ cls: "oh-scroll" });
		this.renderSyncStatus(scroll);
		const pinnedFiles = this.getPinnedFiles();

		if (pinnedFiles.length > 0) {
			const section = scroll.createDiv({ cls: "oh-section" });
			section.createDiv({ cls: "oh-section-label", text: "置顶笔记" });
			const grid = section.createDiv({ cls: "oh-grid" });
			pinnedFiles.forEach((file) => this.renderCard(grid, file, true));
		}

		if (this.plugin.settings.wanderEnabled) this.renderWander(scroll, pinnedFiles);

		const recentSection = scroll.createDiv({ cls: "oh-section" });
		const recentLabel = recentSection.createDiv({ cls: "oh-section-label oh-section-label-row" });
		recentLabel.createSpan({ text: "最近文件" });
		this.renderSortToggle(recentLabel);
		const recentFiles = this.getRecentFiles(pinnedFiles);

		if (recentFiles.length === 0) {
			recentSection.createDiv({ cls: "oh-empty", text: "暂无笔记" });
		} else {
			const grid = recentSection.createDiv({ cls: "oh-grid" });
			recentFiles.forEach((file) => this.renderCard(grid, file, false));
		}

		const fab = container.createEl("button", { cls: "oh-fab", attr: { "aria-label": "新建笔记" } });
		setIcon(fab, "plus");
		fab.addEventListener("click", () => void this.createNote());
	}

	private renderHeader(container: HTMLElement) {
		const header = container.createDiv({ cls: "oh-header" });
		header.createDiv({ cls: "oh-title", text: "ObsidianHome" });
	}

	private renderSyncStatus(parent: HTMLElement) {
		const lastSync = this.plugin.syncWatcher.getLastSyncTime();
		if (lastSync === null) return;
		const el = parent.createDiv({ cls: "oh-sync-status" });
		setIcon(el.createSpan({ cls: "oh-sync-status-icon" }), "refresh-cw");
		el.createSpan({ text: `上次同步 ${formatTime(lastSync)}` });
	}

	// Lightweight single-button toggle: shows the current sort key, click flips it.
	private renderSortToggle(parent: HTMLElement) {
		const sortBy = this.plugin.settings.sortBy;
		const btn = parent.createEl("button", {
			cls: "oh-label-btn",
			attr: { "aria-label": "切换排序方式" },
		});
		setIcon(btn.createSpan({ cls: "oh-label-btn-icon" }), "arrow-up-down");
		btn.createSpan({ text: sortBy === "ctime" ? "创建时间" : "修改时间" });

		btn.addEventListener("click", async () => {
			this.plugin.settings.sortBy = sortBy === "ctime" ? "mtime" : "ctime";
			await this.plugin.saveSettings();
			this.plugin.refreshAllHomeViews();
		});
	}

	private renderWander(parent: HTMLElement, pinnedFiles: TFile[]) {
		const section = parent.createDiv({ cls: "oh-section" });
		const label = section.createDiv({ cls: "oh-section-label oh-section-label-row" });
		label.createSpan({ text: "笔记漫游" });

		const settings = this.plugin.settings;
		const count = settings.wanderCount;
		const candidates = this.getWanderCandidates(pinnedFiles);
		const byPath = new Map(candidates.map((f) => [f.path, f]));
		let files = settings.wanderPaths
			.map((p) => byPath.get(p))
			.filter((f): f is TFile => f !== undefined)
			.slice(0, count);

		// Only top up gaps (deleted notes, larger count) and keep the rest, so
		// picks change solely on manual shuffle. Skip before layout is ready,
		// when the vault file list may still be incomplete.
		if (this.plugin.app.workspace.layoutReady) {
			if (files.length < Math.min(count, candidates.length)) {
				const kept = new Set(files.map((f) => f.path));
				const extra = pickRandom(candidates.filter((f) => !kept.has(f.path)), count - files.length);
				files = files.concat(extra);
			}
			this.saveWanderPaths(files.map((f) => f.path));
		}

		if (candidates.length > 0) {
			const btn = label.createEl("button", { cls: "oh-label-btn", attr: { "aria-label": "换一批漫游笔记" } });
			setIcon(btn.createSpan({ cls: "oh-label-btn-icon" }), "shuffle");
			btn.createSpan({ text: "换一换" });
			btn.addEventListener("click", () => {
				// Avoid repeating the current picks when the pool is large enough.
				const current = new Set(settings.wanderPaths);
				const fresh = candidates.filter((f) => !current.has(f.path));
				const pool = fresh.length >= count ? fresh : candidates;
				this.saveWanderPaths(pickRandom(pool, count).map((f) => f.path));
				this.plugin.refreshAllHomeViews();
			});
		}

		if (files.length === 0) {
			const hint = this.plugin.settings.wanderFolders.length === 0 ? "请在设置中选择漫游文件夹" : "所选文件夹中暂无笔记";
			section.createDiv({ cls: "oh-empty", text: hint });
			return;
		}

		const grid = section.createDiv({ cls: "oh-grid" });
		files.forEach((file) => this.renderCard(grid, file, false));
	}

	private saveWanderPaths(paths: string[]) {
		const settings = this.plugin.settings;
		if (paths.join("\n") === settings.wanderPaths.join("\n")) return;
		settings.wanderPaths = paths;
		void this.plugin.saveSettings();
	}

	private renderCard(grid: HTMLElement, file: TFile, pinned: boolean) {
		const card = grid.createDiv({ cls: pinned ? "oh-card oh-card-pinned" : "oh-card" });

		if (pinned) {
			const tag = card.createDiv({ cls: "oh-card-pin-tag" });
			setIcon(tag.createSpan({ cls: "oh-card-pin-icon" }), "pin");
			tag.createSpan({ text: "已置顶" });
		}

		const titleRow = card.createDiv({ cls: "oh-card-title-row" });
		titleRow.createDiv({ cls: "oh-card-title", text: file.basename });
		const menuBtn = titleRow.createEl("button", { cls: "oh-card-menu-btn", attr: { "aria-label": "更多操作" } });
		setIcon(menuBtn, "more-vertical");

		const previewEl = card.createDiv({ cls: "oh-card-preview" });

		const ts = this.getFileTime(file);
		const folder = file.parent && file.parent.path !== "/" ? file.parent.path : "";
		card.createDiv({ cls: "oh-card-meta", text: folder ? `${formatTime(ts)} · ${folder}` : formatTime(ts) });

		const openMenu = (evt: MouseEvent) => {
			evt.preventDefault();
			const menu = new Menu();
			menu.addItem((item) =>
				item
					.setTitle(pinned ? "取消置顶" : "置顶到此")
					.setIcon(pinned ? "pin-off" : "pin")
					.onClick(() => void this.togglePin(file))
			);
			menu.addItem((item) =>
				item.setTitle("在新标签页中打开").setIcon("file-plus").onClick(() => {
					void this.plugin.app.workspace.getLeaf(true).openFile(file, { active: true });
				})
			);
			menu.showAtMouseEvent(evt);
		};

		menuBtn.addEventListener("click", (evt) => openMenu(evt));
		card.addEventListener("contextmenu", (evt) => openMenu(evt));

		card.addEventListener("click", (evt) => {
			if ((evt.target as HTMLElement).closest(".oh-card-menu-btn")) return;
			void this.leaf.openFile(file, { active: true });
		});

		void loadPreview(this.plugin.app.vault, file, this.plugin.settings.previewLines).then((text) => {
			if (text) previewEl.setText(text);
		});
	}

	private getPinnedFiles(): TFile[] {
		const settings = this.plugin.settings;
		const resolved: TFile[] = [];
		const stale: string[] = [];

		for (const path of settings.pinnedPaths) {
			const file = this.plugin.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) resolved.push(file);
			else stale.push(path);
		}

		if (stale.length > 0) {
			settings.pinnedPaths = settings.pinnedPaths.filter((p) => !stale.includes(p));
			void this.plugin.saveSettings();
		}

		return resolved;
	}

	private getWanderCandidates(exclude: TFile[]): TFile[] {
		const folders = this.plugin.settings.wanderFolders;
		if (folders.length === 0) return [];
		const excluded = new Set(exclude.map((f) => f.path));
		const inFolder = (path: string) => folders.some((dir) => dir === "/" || path.startsWith(`${dir}/`));
		return this.plugin.app.vault.getMarkdownFiles().filter((f) => !excluded.has(f.path) && inFolder(f.path));
	}

	private getRecentFiles(exclude: TFile[]): TFile[] {
		const excluded = new Set(exclude.map((f) => f.path));
		return this.plugin.app.vault
			.getMarkdownFiles()
			.filter((f) => !excluded.has(f.path))
			.map((file) => ({ file, time: this.getFileTime(file) }))
			.sort((a, b) => b.time - a.time)
			.slice(0, this.plugin.settings.limit)
			.map((entry) => entry.file);
	}

	// Prefer the configured frontmatter date (synced files often get a reset
	// ctime/mtime on mobile), falling back to the file's own stat.
	private getFileTime(file: TFile): number {
		const { sortBy, createdProperty, updatedProperty } = this.plugin.settings;
		const property = sortBy === "ctime" ? createdProperty : updatedProperty;
		if (property) {
			const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
			const parsed = parseDateProperty(frontmatter?.[property]);
			if (parsed !== null) return parsed;
		}
		return file.stat[sortBy];
	}

	private async togglePin(file: TFile) {
		const settings = this.plugin.settings;
		const idx = settings.pinnedPaths.indexOf(file.path);
		if (idx >= 0) settings.pinnedPaths.splice(idx, 1);
		else settings.pinnedPaths.push(file.path);
		await this.plugin.saveSettings();
		this.plugin.refreshAllHomeViews();
	}

	private async createNote() {
		const { app } = this.plugin;
		const folder = app.fileManager.getNewFileParent("");
		const base = "未命名";
		const prefix = folder.path && folder.path !== "/" ? `${folder.path}/` : "";

		let candidate = `${prefix}${base}.md`;
		let n = 1;
		while (app.vault.getAbstractFileByPath(candidate)) {
			candidate = `${prefix}${base} ${n}.md`;
			n++;
		}

		const file = await app.vault.create(candidate, "");
		await this.leaf.openFile(file, { active: true });
	}
}
