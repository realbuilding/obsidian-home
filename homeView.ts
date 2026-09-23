import { ItemView, Menu, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type ObsidianHomePlugin from "./main";
import { VIEW_TYPE_HOME } from "./types";
import { formatTime, loadPreview, parseDateProperty } from "./previewUtils";

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
		const pinnedFiles = this.getPinnedFiles();

		if (pinnedFiles.length > 0) {
			const section = scroll.createDiv({ cls: "oh-section" });
			section.createDiv({ cls: "oh-section-label", text: "置顶笔记" });
			const grid = section.createDiv({ cls: "oh-grid" });
			pinnedFiles.forEach((file) => this.renderCard(grid, file, true));
		}

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

	// Lightweight single-button toggle: shows the current sort key, click flips it.
	private renderSortToggle(parent: HTMLElement) {
		const sortBy = this.plugin.settings.sortBy;
		const btn = parent.createEl("button", {
			cls: "oh-sort-toggle",
			attr: { "aria-label": "切换排序方式" },
		});
		setIcon(btn.createSpan({ cls: "oh-sort-toggle-icon" }), "arrow-up-down");
		btn.createSpan({ text: sortBy === "ctime" ? "创建时间" : "修改时间" });

		btn.addEventListener("click", async () => {
			this.plugin.settings.sortBy = sortBy === "ctime" ? "mtime" : "ctime";
			await this.plugin.saveSettings();
			this.plugin.refreshAllHomeViews();
		});
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
