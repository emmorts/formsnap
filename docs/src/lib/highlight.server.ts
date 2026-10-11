import { createHighlighter, type Highlighter } from "shiki";

// Build-time highlighting for hand-placed code samples (the landing page). Markdown fences go
// through the mdsvex highlighter in svelte.config.js; this covers Svelte components that embed
// code directly. Server-only: shiki must never enter the client bundle.

let highlighterPromise: Promise<Highlighter> | undefined;

export async function highlightCode(code: string, lang: string): Promise<string> {
	highlighterPromise ??= createHighlighter({
		themes: ["github-light-default", "github-dark-default"],
		langs: ["svelte", "typescript", "bash"],
	});
	const highlighter = await highlighterPromise;
	return highlighter
		.codeToHtml(code, {
			lang,
			themes: { light: "github-light-default", dark: "github-dark-default" },
			defaultColor: false,
		})
		.replace(' tabindex="0"', "");
}
