import { AbstractInputSuggest, App, PluginSettingTab, Setting, SettingGroup, TAbstractFile, TFolder, setIcon } from "obsidian";
import type ObsidianHomePlugin from "./main";
import { ENCRYPTED_EXTENSION, SortKey } from "./types";

class PathSuggest<T extends TAbstractFile> extends AbstractInputSuggest<T> {
	private getItems: () => T[];
	private onChoose: (item: T) => void;
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement, getItems: () => T[], onChoose: (item: T) => void) {
		super(app, inputEl);
		this.inputEl = inputEl;
		this.getItems = getItems;
		this.onChoose = onChoose;
	}

	protected getSuggestions(query: string): T[] {
		const q = query.toLowerCase();
		return this.getItems()
			.filter((f) => f.path.toLowerCase().includes(q))
			.slice(0, 50);
	}

	renderSuggestion(item: T, el: HTMLElement): void {
		el.setText(item.path);
	}

	selectSuggestion(item: T): void {
		this.inputEl.value = "";
		this.close();
		this.onChoose(item);
	}
}

type ListKey = "pinnedPaths" | "wanderFolders" | "recentIncludeFolders" | "recentExcludeFolders" | "newNoteQuickTerms";

interface PathListOptions<T extends TAbstractFile> {
	key: Exclude<ListKey, "newNoteQuickTerms">;
	name: string;
	desc: string;
	placeholder: string;
	emptyText: string;
	getItems: () => T[];
}

export class ObsidianHomeSettingTab extends PluginSettingTab {
	plugin: ObsidianHomePlugin;

	constructor(app: App, plugin: ObsidianHomePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Sections follow the home page layout from top to bottom.
		const general = this.addGroup(containerEl, "通用");

		new Setting(general)
			.setName("移动端启动时打开首页")
			.setDesc("在手机/平板上启动 Obsidian 后自动切换到 ObsidianHome")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.openOnMobileStartup).onChange(async (value) => {
					this.plugin.settings.openOnMobileStartup = value;
					await this.plugin.saveSettings();
				})
			);

		const pinned = this.addGroup(containerEl, "置顶笔记");

		this.addPathList(pinned, {
			key: "pinnedPaths",
			name: "添加笔记",
			desc: "搜索并选择要固定展示在首页“置顶笔记”区的笔记",
			placeholder: "输入笔记名称搜索…",
			emptyText: "暂无置顶笔记",
			getItems: () => this.app.vault.getFiles().filter((f) => f.extension === "md" || f.extension === ENCRYPTED_EXTENSION),
		});

		const wander = this.addGroup(containerEl, "笔记漫游");

		new Setting(wander)
			.setName("启用笔记漫游")
			.setDesc("在“置顶笔记”下方随机展示所选文件夹中的笔记，点击“换一换”重新抽取")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.wanderEnabled).onChange(async (value) => {
					this.plugin.settings.wanderEnabled = value;
					await this.plugin.saveSettings();
					this.plugin.refreshAllHomeViews();
					this.display();
				})
			);

		if (this.plugin.settings.wanderEnabled) {
			this.addNumberSetting(wander, "漫游数量", "每次随机展示的笔记篇数", "wanderCount", 1);

			this.addPathList(wander, {
				key: "wanderFolders",
				name: "漫游文件夹",
				desc: "从这些文件夹（含子文件夹）中随机抽取笔记",
				placeholder: "输入文件夹名称搜索…",
				emptyText: "暂未选择文件夹",
				getItems: () => this.getFolders(),
			});
		}

		const recent = this.addGroup(containerEl, "最近文件");

		new Setting(recent)
			.setName("排序方式")
			.setDesc("默认排序依据，也可在首页“最近文件”右侧直接切换")
			.addDropdown((drop) =>
				drop
					.addOption("ctime", "创建时间")
					.addOption("mtime", "更新时间")
					.setValue(this.plugin.settings.sortBy)
					.onChange(async (value) => {
						this.plugin.settings.sortBy = value as SortKey;
						await this.plugin.saveSettings();
						this.plugin.refreshAllHomeViews();
					})
			);

		this.addPropertySetting(recent, "创建时间属性", "按创建时间排序时优先读取的笔记属性，留空则使用文件自身的创建时间", "createdProperty");
		this.addPropertySetting(recent, "更新时间属性", "按更新时间排序时优先读取的笔记属性，留空则使用文件自身的修改时间", "updatedProperty");
		this.addNumberSetting(recent, "显示数量", "“最近文件”展示的笔记数量", "limit", 1);
		this.addNumberSetting(recent, "预览行数", "每张卡片展示的正文预览行数，0 表示不显示预览", "previewLines", 0);

		this.addPathList(recent, {
			key: "recentIncludeFolders",
			name: "只展示这些文件夹",
			desc: "仅展示这些文件夹（含子文件夹）中的笔记，留空则展示全部",
			placeholder: "输入文件夹名称搜索…",
			emptyText: "未限制，展示全部文件夹",
			getItems: () => this.getFolders(),
		});

		this.addPathList(recent, {
			key: "recentExcludeFolders",
			name: "不展示这些文件夹",
			desc: "隐藏这些文件夹（含子文件夹）中的笔记，优先于上方设置",
			placeholder: "输入文件夹名称搜索…",
			emptyText: "暂无排除的文件夹",
			getItems: () => this.getFolders(),
		});

		const newNote = this.addGroup(containerEl, "新建笔记");

		this.addQuickTerms(newNote);
	}

	// Native card-style group; returns the element settings are appended to.
	private addGroup(containerEl: HTMLElement, heading: string): HTMLElement {
		return new SettingGroup(containerEl).setHeading(heading).listEl;
	}

	private getFolders(): TFolder[] {
		return this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder);
	}

	// Search box that appends to a settings path list, followed by the list with remove buttons.
	private addPathList<T extends TAbstractFile>(containerEl: HTMLElement, opts: PathListOptions<T>) {
		const settings = this.plugin.settings;
		const update = async (paths: string[]) => {
			settings[opts.key] = paths;
			await this.plugin.saveSettings();
			this.plugin.refreshAllHomeViews();
			this.display();
		};

		const setting = new Setting(containerEl)
			.setName(opts.name)
			.setDesc(opts.desc)
			.addSearch((search) => {
				search.setPlaceholder(opts.placeholder);
				new PathSuggest(this.app, search.inputEl, opts.getItems, (item) => {
					if (!settings[opts.key].includes(item.path)) void update([...settings[opts.key], item.path]);
				});
			});

		this.renderList(setting.infoEl, opts.key, opts.emptyText, update);
	}

	// Free-text terms shown as one-tap search shortcuts in the new-note folder picker.
	private addQuickTerms(containerEl: HTMLElement) {
		const settings = this.plugin.settings;
		const update = async (terms: string[]) => {
			settings.newNoteQuickTerms = terms;
			await this.plugin.saveSettings();
			this.display();
		};
		let draft = "";
		const add = () => {
			const term = draft.trim();
			if (term && !settings.newNoteQuickTerms.includes(term)) void update([...settings.newNoteQuickTerms, term]);
		};

		const setting = new Setting(containerEl)
			.setName("快速搜索词")
			.setDesc("点击首页新建按钮后会弹出文件夹选择框，这些词显示在搜索框下方，点一下即填入搜索")
			.addText((text) => {
				text.setPlaceholder("如：work、日记").onChange((value) => (draft = value));
				text.inputEl.addEventListener("keydown", (e) => {
					if (e.key === "Enter") add();
				});
			})
			.addButton((btn) => btn.setButtonText("添加").onClick(add));

		this.renderList(setting.infoEl, "newNoteQuickTerms", "暂无快速搜索词", update);
	}

	// Compact removable chips under the setting that adds to the list.
	private renderList(containerEl: HTMLElement, key: ListKey, emptyText: string, update: (items: string[]) => Promise<void>) {
		const items = this.plugin.settings[key];
		const listEl = containerEl.createDiv({ cls: "oh-setting-chips" });
		if (items.length === 0) {
			listEl.createSpan({ cls: "oh-setting-chips-empty", text: emptyText });
			return;
		}

		for (const item of items) {
			const chipEl = listEl.createDiv({ cls: "oh-setting-chip", attr: { title: item } });
			chipEl.createSpan({ cls: "oh-setting-chip-text", text: item });
			const removeEl = chipEl.createSpan({ cls: "oh-setting-chip-remove", attr: { "aria-label": "移除" } });
			setIcon(removeEl, "x");
			removeEl.addEventListener("click", () => void update(items.filter((p) => p !== item)));
		}
	}

	private addNumberSetting(containerEl: HTMLElement, name: string, desc: string, key: "limit" | "previewLines" | "wanderCount", min: number) {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) => {
				text.inputEl.type = "number";
				text.inputEl.min = String(min);
				text.inputEl.addClass("oh-setting-number");
				text.setValue(String(this.plugin.settings[key])).onChange(async (value) => {
					const n = parseInt(value, 10);
					if (!isNaN(n) && n >= min) {
						this.plugin.settings[key] = n;
						await this.plugin.saveSettings();
						this.plugin.refreshAllHomeViews();
					}
				});
			});
	}

	private addPropertySetting(containerEl: HTMLElement, name: string, desc: string, key: "createdProperty" | "updatedProperty") {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) =>
				text.setValue(this.plugin.settings[key]).onChange(async (value) => {
					this.plugin.settings[key] = value.trim();
					await this.plugin.saveSettings();
					this.plugin.refreshAllHomeViews();
				})
			);
	}
}
