import { createHighlighter } from "shiki";
import { mdsvex, escapeSvelte } from "mdsvex";
import rehypeSlug from "rehype-slug";
import { rehypeTableScroll } from "./src/lib/markdown/rehype-table-scroll.js";
import { rehypeBaseLinks } from "./src/lib/markdown/rehype-base-links.js";
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

const highlighter = await createHighlighter({
	themes: ["github-light-default", "github-dark-default"],
	langs: ["svelte", "typescript", "javascript", "bash", "json", "html", "css", "diff"],
});

/** Render fenced code blocks with dual light/dark themes so the site toggle can swap them in CSS. */
function highlight(code, lang, meta) {
	const language = highlighter.getLoadedLanguages().includes(lang) ? lang : "text";
	const html = highlighter
		.codeToHtml(code, {
			lang: language,
			themes: { light: "github-light-default", dark: "github-dark-default" },
			defaultColor: false,
		})
		// The scrollable region handles keyboard focus; a tabindex on <pre> trips a11y checks.
		.replace(' tabindex="0"', "");
	const title = /title="([^"]+)"/.exec(meta ?? "")?.[1];
	const header = title
		? `<div class="code-header"><span>${title}</span><button type="button" class="code-copy" aria-label="Copy code" data-code="${encodeURIComponent(code)}">Copy</button></div>`
		: `<button type="button" class="code-copy code-copy--floating" aria-label="Copy code" data-code="${encodeURIComponent(code)}">Copy</button>`;
	return `<div class="code-block" data-language="${language}">${header}${html}</div>`;
}

const isPages = process.env.GITHUB_ACTIONS === "true";

/** Deployment base path: the repository name on GitHub Pages, empty for local builds. */
const base = isPages ? `/${process.env.GITHUB_REPOSITORY?.split("/")[1] ?? ""}` : "";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: [".svelte", ".md", ".svx"],
	preprocess: [
		vitePreprocess(),
		mdsvex({
			extensions: [".md", ".svx"],
			layout: fileURLToPath(
				new URL("./src/lib/markdown/docs-layout.svelte", import.meta.url)
			),
			highlight: {
				highlighter: (code, lang, meta) => escapeSvelte(highlight(code, lang, meta)),
			},
			// Heading ids feed the "On this page" rail and make sections deep-linkable; tables get a
			// scroll container; markdown links get the deployment base path prefix. The base plugin
			// takes its base as a unified option, so it is registered as [plugin, options].
			rehypePlugins: [rehypeSlug, rehypeTableScroll, [rehypeBaseLinks, base]],
		}),
	],
	kit: {
		adapter: adapter({ fallback: "404.html" }),
		paths: { base },
		alias: {
			$multiStepRecipe: fileURLToPath(
				new URL("../packages/formsnap/src/routes/recipes/multi-step", import.meta.url)
			),
		},
		prerender: { handleHttpError: "warn" },
	},
};

export default config;
