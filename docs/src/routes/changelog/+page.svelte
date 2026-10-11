<script lang="ts">
	import { marked, Renderer } from "marked";
	import GithubSlugger from "github-slugger";
	import changelog from "../../../../packages/formsnap/CHANGELOG.md?raw";

	// Render the package changelog as-is: it is the single source of truth for release notes.
	// Heading ids come from the same slugger rehype-slug applies to markdown pages, so changelog
	// anchors, the "on this page" rail and deep links behave like every other page.
	// The changelog keeps an empty `## Unreleased` heading ready for the next release. Hide it —
	// and its "on this page" entry — until it documents something, using the same emptiness rule
	// as scripts/release-notes.mjs so the site and the release tooling agree.
	function withoutEmptyUnreleased(markdown: string): string {
		const lines = markdown.split(/\r?\n/);
		const start = lines.indexOf("## Unreleased");
		if (start === -1) return markdown;
		let end = start + 1;
		while (end < lines.length && !lines[end].startsWith("## ")) end += 1;
		const body = lines
			.slice(start + 1, end)
			.join("\n")
			.replace(/^#{3,6} .*$/gm, "")
			.replace(/<!--[\s\S]*?-->/g, "");
		if (body.trim()) return markdown;
		lines.splice(start, end - start);
		return lines.join("\n");
	}

	const slugger = new GithubSlugger();
	const renderer = new Renderer();

	renderer.heading = ({ tokens, depth }) => {
		const content = marked.parseInline(tokens.map((token) => token.raw).join(""), {
			async: false,
		});
		// Slug the rendered text, matching rehype-slug, which reads an element's text content.
		const id = slugger.slug(content.replace(/<[^>]+>/g, ""));
		return `<h${depth} id="${id}">${content}</h${depth}>`;
	};

	const html = marked.parse(withoutEmptyUnreleased(changelog), {
		gfm: true,
		async: false,
		renderer,
	});
</script>

<svelte:head>
	<title>Changelog — Formsnap</title>
	<meta
		name="description"
		content="Release history for @emmorts/formsnap, published from the package changelog."
	/>
</svelte:head>

<div class="docs-prose">
	<!-- The repository's own CHANGELOG.md, rendered at build time; no user input reaches it. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html html}
</div>
