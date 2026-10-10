#!/usr/bin/env node
// Builds the documentation site that is published to GitHub Pages from the repository's own
// markdown:
//
//   node scripts/build-docs-site.mjs --renderer "$RUNNER_TEMP/docs-tools" \
//     --base /formsnap/ --repo-url https://github.com/emmorts/formsnap --ref main --out _site
//
// The markdown renderer is deliberately not a workspace dependency. The docs workflow installs an
// exact version into a temporary prefix and passes that directory here, so this script adds nothing
// to the published package or the lockfile. Every assertion in this file fails the build rather
// than publishing a page with a broken link or unrendered markdown.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/**
 * The published pages, in navigation order. Only public documentation is published;
 * the fixture routes cannot run without a server.
 */
const PAGES = [
	{
		route: "",
		source: "packages/formsnap/README.md",
		label: "Documentation",
		title: "Documentation",
	},
	{ route: "readme", source: "README.md", label: "Repository", title: "Repository README" },
	{
		route: "changelog",
		source: "packages/formsnap/CHANGELOG.md",
		label: "Changelog",
		title: "Changelog",
	},
];

function fail(message) {
	console.error(`docs-site: ${message}`);
	process.exit(1);
}

/** Flags map to option names, so `--repo-url` sets `repoUrl`. */
const FLAGS = {
	"--out": "out",
	"--base": "base",
	"--repo-url": "repoUrl",
	"--ref": "ref",
	"--renderer": "renderer",
};

function parseArguments(argv) {
	const options = {
		out: "_site",
		base: "/",
		repoUrl: "",
		ref: "main",
		renderer: process.env.DOCS_RENDERER_DIR ?? path.join(ROOT, ".docs-tools"),
	};
	for (let index = 0; index < argv.length; index += 2) {
		const flag = argv[index];
		const key = FLAGS[flag];
		if (!key) fail(`unknown option ${flag}`);
		const value = argv[index + 1];
		if (value === undefined) fail(`${flag} needs a value`);
		options[key] = value;
	}
	options.out = path.resolve(ROOT, options.out);
	if (!options.base.endsWith("/")) options.base += "/";
	if (options.repoUrl.endsWith("/")) options.repoUrl = options.repoUrl.slice(0, -1);
	return options;
}

/** Loads the pinned markdown renderer from the directory the workflow installed it into. */
async function loadMarked(directory) {
	const require = createRequire(path.join(path.resolve(directory), "docs-renderer.cjs"));
	let resolved;
	try {
		resolved = require.resolve("marked");
	} catch (error) {
		fail(`could not find "marked" installed in ${directory}: ${error.message}`);
	}
	// The renderer is ESM-only, so resolve it from the install directory and import the file.
	const loaded = await import(pathToFileURL(resolved).href);
	const marked = loaded.marked ?? loaded.default;
	if (!marked?.parse) fail(`"${resolved}" does not export a marked parser`);
	return marked;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

/**
 * The heading anchors GitHub generates, so that the links written for the repository keep working
 * on the site. Anything the two disagree about is caught by the anchor assertions below.
 */
function slugify(text) {
	return text
		.replace(/<[^>]*>/g, "")
		.replace(/&(#?\w+);/g, (match, name) => ENTITIES[name] ?? match)
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\p{M} _-]/gu, "")
		.trim()
		.replace(/\s+/g, "-");
}

function addHeadingIds(html) {
	const ids = new Set();
	const withIds = html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (match, level, inner) => {
		const base = slugify(inner);
		let id = base;
		for (let suffix = 1; ids.has(id); suffix += 1) id = `${base}-${suffix}`;
		ids.add(id);
		return `<h${level} id="${id}">${inner}</h${level}>`;
	});
	return { html: withIds, ids };
}

function renderMarkdown(markdown, marked) {
	return addHeadingIds(String(marked.parse(markdown, { gfm: true })));
}

/**
 * Rewrites one link target. Repository files become GitHub URLs, published pages become site
 * routes, and an in-page anchor must resolve to a heading the renderer produced.
 */
function resolveTarget(value, page, context) {
	if (value.startsWith("#")) {
		assertAnchor(value, page);
		return value;
	}
	if (value.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(value)) return value;

	const hash = value.indexOf("#");
	const target = hash === -1 ? value : value.slice(0, hash);
	const anchor = hash === -1 ? "" : value.slice(hash);
	const repositoryPath = path.posix.normalize(
		target.startsWith("/")
			? target.slice(1)
			: path.posix.join(path.posix.dirname(page.source), target)
	);

	const published = context.bySource.get(repositoryPath);
	if (published) {
		if (anchor) assertAnchor(anchor, published);
		return `${context.base}${published.route ? `${published.route}/` : ""}${anchor}`;
	}
	if (!context.repoUrl) fail(`${page.source} links to ${value} and no --repo-url was given`);

	// A directory target needs the tree URL; a file target needs the blob URL.
	const absolute = path.join(ROOT, repositoryPath);
	const kind = existsSync(absolute) && statSync(absolute).isDirectory() ? "tree" : "blob";
	return `${context.repoUrl}/${kind}/${context.ref}/${repositoryPath}${anchor}`;
}

function assertAnchor(anchor, page) {
	const id = decodeURIComponent(anchor.slice(1));
	if (!page.ids.has(id))
		fail(`${page.source} links to ${anchor}, which no heading on that page produces`);
}

function rewriteLinks(html, page, context) {
	return html.replace(/(href|src)="([^"]*)"/g, (match, attribute, value) => {
		return `${attribute}="${resolveTarget(value, page, context)}"`;
	});
}

const STYLES = `
:root { color-scheme: light dark; --bg: #ffffff; --fg: #1b1b1f; --muted: #5d5d68; --border: #e2e2e6; --accent: #326ce5; --surface: #f7f7fa; }
@media (prefers-color-scheme: dark) { :root { --bg: #131316; --fg: #e6e6ea; --muted: #a0a0aa; --border: #2c2c33; --accent: #8ab4ff; --surface: #1b1b20; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
a { color: var(--accent); }
header, footer { border-color: var(--border); padding: 0.75rem 1.25rem; }
header { border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 1rem; align-items: baseline; }
header .name { font-weight: 600; }
footer { border-top: 1px solid var(--border); color: var(--muted); font-size: 0.875rem; }
nav ul { display: flex; flex-wrap: wrap; gap: 1rem; list-style: none; margin: 0; padding: 0; }
nav [aria-current="page"] { color: var(--fg); font-weight: 600; text-decoration: none; }
main { margin: 0 auto; max-width: 52rem; padding: 1.5rem 1.25rem 4rem; }
h1, h2, h3, h4 { line-height: 1.25; }
h1 { font-size: 1.75rem; } h2 { border-bottom: 1px solid var(--border); font-size: 1.35rem; padding-bottom: 0.25rem; margin-top: 2.5rem; }
h3 { font-size: 1.15rem; margin-top: 2rem; }
code { background: var(--surface); border-radius: 0.25rem; font-size: 0.9em; padding: 0.1em 0.3em; }
pre { background: var(--surface); border: 1px solid var(--border); border-radius: 0.5rem; overflow-x: auto; padding: 0.75rem 1rem; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; display: block; overflow-x: auto; }
th, td { border: 1px solid var(--border); padding: 0.4rem 0.6rem; text-align: left; }
blockquote { border-left: 3px solid var(--border); color: var(--muted); margin-left: 0; padding-left: 1rem; }
img { max-width: 100%; }
`.trim();

function renderPage({ page, pages, content, base, repoUrl }) {
	const nav = pages
		.map(({ route, label }) => {
			const href = `${base}${route ? `${route}/` : ""}`;
			const current = route === page.route ? ' aria-current="page"' : "";
			return `\t\t\t\t<li><a href="${href}"${current}>${label}</a></li>`;
		})
		.join("\n");
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>${page.title} · Formsnap</title>
		<style>
${STYLES}
		</style>
	</head>
	<body>
		<header>
			<span class="name">Formsnap</span>
			<nav aria-label="Documentation">
				<ul>
${nav}
				</ul>
			</nav>
		</header>
		<main>
${content}
		</main>
		<footer>
			Generated from this repository's markdown. The package is published as
			<a href="https://www.npmjs.com/package/@emmorts/formsnap">@emmorts/formsnap</a>; the API
			guide is <a href="https://formsnap.dev">formsnap.dev</a>.
			${repoUrl ? `Source: <a href="${repoUrl}">${repoUrl.replace("https://", "")}</a>.` : ""}
		</footer>
	</body>
</html>
`;
}

function renderNotFound({ pages, base }) {
	const links = pages
		.map(
			({ route, title }) =>
				`\t\t\t<li><a href="${base}${route ? `${route}/` : ""}">${title}</a></li>`
		)
		.join("\n");
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Page not found · Formsnap</title>
		<style>
${STYLES}
		</style>
	</head>
	<body>
		<main>
			<h1>Page not found</h1>
			<p>This page does not exist in the generated documentation.</p>
			<ul>
${links}
			</ul>
		</main>
	</body>
</html>
`;
}

function writePage(output, route, html) {
	const directory = path.join(output, route);
	mkdirSync(directory, { recursive: true });
	writeFileSync(path.join(directory, "index.html"), html);
}

async function main() {
	const options = parseArguments(process.argv.slice(2));
	const marked = await loadMarked(options.renderer);

	const pages = PAGES.map((page) => {
		const file = path.join(ROOT, page.source);
		if (!existsSync(file)) fail(`${page.source} does not exist`);
		const { html, ids } = renderMarkdown(readFileSync(file, "utf8"), marked);
		return { ...page, ids, content: html };
	});

	const context = {
		...options,
		bySource: new Map(pages.map((page) => [page.source, page])),
	};
	for (const page of pages) {
		// Links are rewritten only after every page is rendered, so a target page's headings are
		// known and a link to a heading that does not exist fails the build.
		page.content = rewriteLinks(page.content, page, context);
	}

	rmSync(options.out, { recursive: true, force: true });
	for (const page of pages) {
		const html = renderPage({ page, pages, content: page.content, ...options });
		for (const [label, condition] of [
			["a heading", html.includes("<h1")],
			["rendered code blocks", !html.includes("```")],
			["rendered links", !html.includes("](")],
			["a closing document", html.includes("</html>")],
		]) {
			if (!condition) fail(`the page for ${page.route || "/"} has no ${label}`);
		}
		writePage(options.out, page.route, html);
		console.log(
			`docs-site: /${page.route} from ${page.source} (${html.length} bytes, ${page.ids.size} anchors)`
		);
	}
	writeFileSync(path.join(options.out, "404.html"), renderNotFound({ pages, ...options }));
	console.log(`docs-site: wrote ${pages.length + 1} pages to ${options.out}`);
}

await main();
