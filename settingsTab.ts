import { AbstractInputSuggest, App, PluginSettingTab, Setting, TAbstractFile, TFolder } from "obsidian";
import type ObsidianHomePlugin from "./main";
import { SortKey } from "./types";

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

interface PathListOptions<T extends TAbstractFile> {
	key: "pinnedPaths" | "wanderFolders";
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

		new Setting(containerEl)
			.setName("排序方式")
			.setDesc("首页“最近文件”的默认排序依据，也可在首页“最近文件”右侧直接切换")
			.addDropdown((drop) =>
				drop
					.addOption("ctime", "创建时间")
					.addOption("mtime", "修改时间")
					.setValue(this.plugin.settings.sortBy)
					.onChange(async (value) => {
						this.plugin.settings.sortBy = value as SortKey;
						await this.plugin.saveSettings();
						this.plugin.refreshAllHomeViews();
					})
			);

		this.addPropertySetting(containerEl, "创建时间属性", "按创建时间排序时优先读取的笔记属性，留空则使用文件自身的创建时间", "createdProperty");
		this.addPropertySetting(containerEl, "修改时间属性", "按修改时间排序时优先读取的笔记属性，留空则使用文件自身的修改时间", "updatedProperty");

		new Setting(containerEl)
			.setName("移动端启动时打开首页")
			.setDesc("在手机/平板上启动 Obsidian 后自动切换到 ObsidianHome")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.openOnMobileStartup).onChange(async (value) => {
					this.plugin.settings.openOnMobileStartup = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("显示数量")
			.setDesc("“最近文件”展示的笔记数量")
			.addText((text) =>
				text.setValue(String(this.plugin.settings.limit)).onChange(async (value) => {
					const n = parseInt(value, 10);
					if (!isNaN(n) && n > 0) {
						this.plugin.settings.limit = n;
						await this.plugin.saveSettings();
						this.plugin.refreshAllHomeViews();
					}
				})
			);

		new Setting(containerEl)
			.setName("预览行数")
			.setDesc("每张卡片展示的正文预览行数")
			.addText((text) =>
				text.setValue(String(this.plugin.settings.previewLines)).onChange(async (value) => {
					const n = parseInt(value, 10);
					if (!isNaN(n) && n >= 0) {
						this.plugin.settings.previewLines = n;
						await this.plugin.saveSettings();
						this.plugin.refreshAllHomeViews();
					}
				})
			);

		new Setting(containerEl).setName("置顶笔记").setHeading();

		this.addPathList(containerEl, {
			key: "pinnedPaths",
			name: "添加笔记",
			desc: "搜索并选择要固定展示在首页“置顶笔记”区的笔记",
			placeholder: "输入笔记名称搜索…",
			emptyText: "暂无置顶笔记",
			getItems: () => this.app.vault.getMarkdownFiles(),
		});

		new Setting(containerEl).setName("笔记漫游").setHeading();

		new Setting(containerEl)
			.setName("启用笔记漫游")
			.setDesc("在“置顶笔记”下方随机展示所选文件夹中的笔记，点击“换一换”重新抽取")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.wanderEnabled).onChange(async (value) => {
					this.plugin.settings.wanderEnabled = value;
					await this.plugin.saveSettings();
					this.plugin.refreshAllHomeViews();
				})
			);

		new Setting(containerEl)
			.setName("漫游数量")
			.setDesc("每次随机展示的笔记篇数")
			.addText((text) =>
				text.setValue(String(this.plugin.settings.wanderCount)).onChange(async (value) => {
					const n = parseInt(value, 10);
					if (!isNaN(n) && n > 0) {
						this.plugin.settings.wanderCount = n;
						await this.plugin.saveSettings();
						this.plugin.refreshAllHomeViews();
					}
				})
			);

		this.addPathList(containerEl, {
			key: "wanderFolders",
			name: "添加文件夹",
			desc: "从这些文件夹（含子文件夹）中随机抽取笔记",
			placeholder: "输入文件夹名称搜索…",
			emptyText: "暂未选择文件夹",
			getItems: () => this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder),
		});
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

		new Setting(containerEl)
			.setName(opts.name)
			.setDesc(opts.desc)
			.addSearch((search) => {
				search.setPlaceholder(opts.placeholder);
				new PathSuggest(this.app, search.inputEl, opts.getItems, (item) => {
					if (!settings[opts.key].includes(item.path)) void update([...settings[opts.key], item.path]);
				});
			});

		if (settings[opts.key].length === 0) {
			containerEl.createDiv({ cls: "setting-item-description", text: opts.emptyText });
		}

		for (const path of settings[opts.key]) {
			new Setting(containerEl).setName(path).addExtraButton((btn) =>
				btn
					.setIcon("x")
					.setTooltip("移除")
					.onClick(() => void update(settings[opts.key].filter((p) => p !== path)))
			);
		}
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
