import { App, FuzzyMatch, FuzzySuggestModal, Platform, TFolder } from "obsidian";

// Folder picker shown before creating a note; quick terms are one-tap search shortcuts.
export class FolderPickerModal extends FuzzySuggestModal<TFolder> {
	private quickTerms: string[];
	private onChoose: (folder: TFolder) => void;

	constructor(app: App, quickTerms: string[], onChoose: (folder: TFolder) => void) {
		super(app);
		this.quickTerms = quickTerms;
		this.onChoose = onChoose;
		this.setPlaceholder("搜索新笔记所在文件夹…");
		this.emptyStateText = "没有匹配的文件夹";
		this.modalEl.addClass("oh-folder-picker");
		this.setInstructions([
			{ command: "↵", purpose: "在此文件夹新建" },
			{ command: "esc", purpose: "取消" },
		]);
	}

	onOpen() {
		super.onOpen();
		// On mobile, quick terms are the main entry; don't pop the keyboard until the input is tapped.
		if (Platform.isMobile) window.setTimeout(() => this.inputEl.blur(), 0);
		if (this.quickTerms.length === 0) return;
		const bar = createDiv({ cls: "oh-quick-terms" });
		this.resultContainerEl.before(bar);
		for (const term of this.quickTerms) {
			bar.createEl("button", { cls: "oh-quick-term", text: term }).addEventListener("click", () => {
				this.inputEl.value = term;
				this.inputEl.dispatchEvent(new Event("input"));
				if (!Platform.isMobile) this.inputEl.focus();
			});
		}
	}

	// Listing every folder is useless in a large vault, so results stay hidden until there is a query.
	getSuggestions(query: string): FuzzyMatch<TFolder>[] {
		const idle = query.trim() === "";
		this.modalEl.toggleClass("oh-picker-idle", idle);
		return idle ? [] : super.getSuggestions(query);
	}

	getItems(): TFolder[] {
		const folders = this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder);
		// Root first, then alphabetical so equal-score matches are ordered predictably.
		return folders.sort((a, b) => (a.isRoot() ? -1 : b.isRoot() ? 1 : a.path.localeCompare(b.path)));
	}

	getItemText(folder: TFolder): string {
		return folder.isRoot() ? "/" : folder.path;
	}

	onChooseItem(folder: TFolder): void {
		this.onChoose(folder);
	}
}
