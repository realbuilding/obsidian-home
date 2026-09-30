import { App, Modal, Notice, Platform, TFile } from "obsidian";
import type ObsidianHomePlugin from "./main";
import { parseRating } from "./previewUtils";

const MAX_CARD_SAMPLES = 8;

function describeValue(value: unknown): string {
	if (value === undefined) return "undefined";
	let json: string;
	try {
		json = JSON.stringify(value);
	} catch {
		json = String(value);
	}
	return `${json} (${Array.isArray(value) ? "array" : typeof value})`;
}

function describeStyle(el: Element | null): string {
	if (!el) return "none";
	const s = getComputedStyle(el);
	const rect = el.getBoundingClientRect();
	return `display=${s.display} visibility=${s.visibility} opacity=${s.opacity} size=${Math.round(rect.width)}x${Math.round(rect.height)} color=${s.color}`;
}

// Reads the raw `rating:` line from the note's frontmatter, bypassing the metadata cache.
async function readRawRatingLine(app: App, file: TFile): Promise<string> {
	try {
		const text = await app.vault.cachedRead(file);
		const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
		if (!match) return "no frontmatter block";
		const line = match[1].split(/\r?\n/).find((l) => /^\s*rating\s*:/i.test(l));
		return line ? JSON.stringify(line) : "no rating line";
	} catch (e) {
		return `read failed: ${String(e)}`;
	}
}

// Collects rating-related state without note names or paths, so the output can be shared.
export async function collectDiagnostics(plugin: ObsidianHomePlugin): Promise<string> {
	const { app } = plugin;
	const lines: string[] = [];

	lines.push(`plugin: ${plugin.manifest.version}`);
	lines.push(
		`platform: mobile=${Platform.isMobile} android=${Platform.isAndroidApp} ios=${Platform.isIosApp} phone=${Platform.isPhone}`
	);
	lines.push(`viewport: ${window.innerWidth}x${window.innerHeight}`);
	lines.push(`userAgent: ${navigator.userAgent}`);

	const files = app.vault.getMarkdownFiles();
	let withCache = 0;
	let withFrontmatter = 0;
	let withRating = 0;
	let parsedOk = 0;
	const ratingKinds = new Map<string, number>();
	for (const file of files) {
		const cache = app.metadataCache.getFileCache(file);
		if (cache) withCache++;
		const fm = cache?.frontmatter;
		if (!fm) continue;
		withFrontmatter++;
		// Also catch differently-cased keys such as "Rating".
		const key = Object.keys(fm).find((k) => k.toLowerCase() === "rating");
		if (!key) continue;
		withRating++;
		if (parseRating(fm[key]) !== null && key === "rating") parsedOk++;
		const kind = `key=${key} ${describeValue(fm[key])}`;
		ratingKinds.set(kind, (ratingKinds.get(kind) ?? 0) + 1);
	}
	lines.push("");
	lines.push(`vault: md=${files.length} cached=${withCache} frontmatter=${withFrontmatter} rating=${withRating} parsedOk=${parsedOk}`);
	[...ratingKinds.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.forEach(([kind, count]) => lines.push(`  ${count} × ${kind}`));

	const roots = document.querySelectorAll(".oh-root");
	const cards = Array.from(document.querySelectorAll<HTMLElement>(".oh-card"));
	const badges = document.querySelectorAll(".oh-card-rating");
	lines.push("");
	lines.push(`dom: homeViews=${roots.length} cards=${cards.length} badges=${badges.length}`);
	lines.push(`firstBadgeStyle: ${describeStyle(badges[0] ?? null)}`);

	// Prefer cards whose note has a rating in the cache or on disk, since those are the interesting ones.
	const samples: string[] = [];
	for (const [index, card] of cards.entries()) {
		if (samples.length >= MAX_CARD_SAMPLES) break;
		const path = card.dataset.path;
		const file = path ? app.vault.getAbstractFileByPath(path) : null;
		if (!(file instanceof TFile)) continue;
		const raw = app.metadataCache.getFileCache(file)?.frontmatter?.rating;
		const rawLine = await readRawRatingLine(app, file);
		if (raw === undefined && rawLine.startsWith("no ")) continue;
		const badge = card.querySelector(".oh-card-rating");
		const titleRow = card.querySelector(".oh-card-title-row");
		samples.push(
			`card#${index}: cache=${describeValue(raw)} parsed=${parseRating(raw)} disk=${rawLine}\n` +
				`    badge=${badge ? "yes" : "no"} badgeStyle: ${describeStyle(badge)}\n` +
				`    titleRow: ${describeStyle(titleRow)} children=${titleRow?.childElementCount ?? 0}`
		);
	}
	lines.push(`cardsWithRating (first ${MAX_CARD_SAMPLES}):`);
	if (samples.length === 0) lines.push("  none");
	else samples.forEach((s) => lines.push(`  ${s}`));

	return lines.join("\n");
}

export class DiagnosticsModal extends Modal {
	constructor(app: App, private text: string) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		this.titleEl.setText("ObsidianHome 诊断信息");
		contentEl.createEl("p", { text: "不含笔记名与路径，可直接复制发送。" });
		const area = contentEl.createEl("textarea", { cls: "oh-diagnostics-text" });
		area.value = this.text;
		area.readOnly = true;
		area.rows = 16;

		const btn = contentEl.createEl("button", { cls: "mod-cta", text: "复制" });
		btn.addEventListener("click", () => {
			navigator.clipboard.writeText(this.text).then(
				() => new Notice("诊断信息已复制"),
				() => {
					// Clipboard API can be unavailable in some WebViews; fall back to manual selection.
					area.focus();
					area.select();
					new Notice("自动复制失败，请手动全选复制");
				}
			);
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}
