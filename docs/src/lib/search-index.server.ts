import GithubSlugger from "github-slugger";
import { marked, type Token } from "marked";
import type { SearchEntry } from "./search.js";

/** Strip formatting through the Markdown parser, not a heading regex that also sees code fences. */
function inlineText(markdown: string): string {
	return marked
		.lexer(markdown)
		.map((token) => tokenText(token))
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
}

function tokenText(token: Token): string {
	if (token.type === "html" || token.type === "space" || token.type === "hr") return "";
	if ("tokens" in token && Array.isArray(token.tokens)) {
		return token.tokens.map(tokenText).join("");
	}
	if (token.type === "list") return token.items.map(tokenText).join(" ");
	if (token.type === "table") {
		return [...token.header, ...token.rows.flat()]
			.map((cell) => cell.tokens.map(tokenText).join(""))
			.join(" ");
	}
	return "text" in token && typeof token.text === "string" ? token.text : "";
}

/** The source is trusted repository Markdown; generated entries are rendered as text, never HTML. */
export function indexPage(source: string, href: string, fallbackTitle: string): SearchEntry[] {
	const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
	const metadata = frontmatter?.[1] ?? "";
	const title = /^title:\s*(.+)$/m.exec(metadata)?.[1]?.trim() ?? fallbackTitle;
	const description = /^description:\s*(.+)$/m.exec(metadata)?.[1]?.trim() ?? "";
	const tokens = marked.lexer(source.slice(frontmatter?.[0].length ?? 0));
	const slugger = new GithubSlugger();
	const entries: SearchEntry[] = [{ href, title, section: "", text: description }];
	let current = entries[0];
	for (const token of tokens) {
		if (token.type === "heading") {
			const section = inlineText(token.text);
			current = { href: `${href}#${slugger.slug(section)}`, title, section, text: "" };
			entries.push(current);
		} else {
			const text = tokenText(token).replace(/\s+/g, " ").trim();
			if (text) current.text += `${current.text ? " " : ""}${text}`;
		}
	}
	return entries;
}
