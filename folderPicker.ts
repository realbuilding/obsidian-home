import { App, FuzzySuggestModal, TFolder } from "obsidian";

// Folder picker shown before creating a note; quick terms are one-tap search shortcuts.
export class FolderPickerModal extends FuzzySuggestModal<TFolder> {
	private quickTerms: string[];
	private onChoose: (folder: TFolder) => void;

	constructor(app: App, quickTerms: string[], onChoose: (folder: TFolder) => void) {
		super(app);
		this.quickTerms = quickTerms;
		this.onChoose = onChoose;
		this.setPlaceholder("选择新笔记所在文件夹…");
		this.setInstructions([
			{ command: "↵", purpose: "在此文件夹新建" },
			{ command: "esc", purpose: "取消" },
		]);
	}

	onOpen() {
		super.onOpen();
		if (this.quickTerms.length === 0) return;
		const bar = createDiv({ cls: "oh-quick-terms" });
		this.resultContainerEl.before(bar);
		for (const term of this.quickTerms) {
			bar.createEl("button", { cls: "oh-quick-term", text: term }).addEventListener("click", () => {
				this.inputEl.value = term;
				this.inputEl.dispatchEvent(new Event("input"));
				this.inputEl.focus();
			});
		}
	}

	getItems(): TFolder[] {
		const folders = this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder);
		// Root first, then alphabetical so the empty-query list is predictable.
		return folders.sort((a, b) => (a.isRoot() ? -1 : b.isRoot() ? 1 : a.path.localeCompare(b.path)));
	}

	getItemText(folder: TFolder): string {
		return folder.isRoot() ? "/" : folder.path;
	}

	onChooseItem(folder: TFolder): void {
		this.onChoose(folder);
	}
}
