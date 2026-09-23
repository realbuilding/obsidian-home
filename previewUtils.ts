import { TFile, Vault, moment } from "obsidian";

const DATE_FORMATS = [moment.ISO_8601, "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm", "YYYY/MM/DD HH:mm", "YYYY/MM/DD"];

export async function loadPreview(vault: Vault, file: TFile, lines: number): Promise<string> {
	if (lines <= 0) return "";
	try {
		const raw = await vault.cachedRead(file);
		return extractPreview(raw, lines);
	} catch (e) {
		return "";
	}
}

export function extractPreview(raw: string, lines: number): string {
	let content = raw.replace(/\r\n/g, "\n");

	if (content.startsWith("---\n")) {
		const closeIdx = content.indexOf("\n---", 4);
		if (closeIdx !== -1) content = content.slice(closeIdx + 4);
	}

	const cleaned = content
		.split("\n")
		.map((l) => stripMarkdown(l.trim()))
		.filter((l) => l.length > 0);

	return cleaned.slice(0, lines).join(" ");
}

export function stripMarkdown(line: string): string {
	return line
		.replace(/^#{1,6}\s+/, "")
		.replace(/^[-*+]\s+/, "")
		.replace(/^\d+\.\s+/, "")
		.replace(/^>\s?/, "")
		.replace(/!\[\[([^\]]+)\]\]/g, "$1")
		.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, (_m, p1, p2) => (p2 ? p2.slice(1) : p1))
		.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/[*_`~]/g, "")
		.trim();
}

export function formatTime(ts: number): string {
	return moment(ts).format("YYYY-MM-DD HH:mm");
}

// Parse a frontmatter date value; strict formats avoid Safari's (mobile WebView)
// inconsistent Date.parse handling of non-ISO strings.
export function parseDateProperty(value: unknown): number | null {
	if (typeof value !== "string") return null;
	const parsed = moment(value.trim(), DATE_FORMATS, true);
	return parsed.isValid() ? parsed.valueOf() : null;
}
