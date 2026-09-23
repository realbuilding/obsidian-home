import { AbstractInputSuggest, App, PluginSettingTab, Setting, TFile } from "obsidian";
import type ObsidianHomePlugin from "./main";
import { SortKey } from "./types";

class FileSuggest extends AbstractInputSuggest<TFile> {
	private onChoose: (file: TFile) => void;
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement, onChoose: (file: TFile) => void) {
		super(app, inputEl);
		this.inputEl = inputEl;
		this.onChoose = onChoose;
	}

	protected getSuggestions(query: string): TFile[] {
		const q = query.toLowerCase();
		return this.app.vault
			.getMarkdownFiles()
			.filter((f) => f.path.toLowerCase().includes(q))
			.slice(0, 50);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.inputEl.value = "";
		this.close();
		this.onChoose(file);
	}
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

		new Setting(containerEl)
			.setName("添加笔记")
			.setDesc("搜索并选择要固定展示在首页“置顶笔记”区的笔记")
			.addSearch((search) => {
				search.setPlaceholder("输入笔记名称搜索…");
				new FileSuggest(this.app, search.inputEl, async (file) => {
					if (!this.plugin.settings.pinnedPaths.includes(file.path)) {
						this.plugin.settings.pinnedPaths.push(file.path);
						await this.plugin.saveSettings();
						this.plugin.refreshAllHomeViews();
						this.display();
					}
				});
			});

		if (this.plugin.settings.pinnedPaths.length === 0) {
			containerEl.createDiv({ cls: "setting-item-description", text: "暂无置顶笔记" });
		}

		for (const path of this.plugin.settings.pinnedPaths) {
			new Setting(containerEl).setName(path).addExtraButton((btn) =>
				btn
					.setIcon("x")
					.setTooltip("移除")
					.onClick(async () => {
						this.plugin.settings.pinnedPaths = this.plugin.settings.pinnedPaths.filter((p) => p !== path);
						await this.plugin.saveSettings();
						this.plugin.refreshAllHomeViews();
						this.display();
					})
			);
		}
	}
}
