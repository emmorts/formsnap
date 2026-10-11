<script lang="ts">
	import { marked } from "marked";
	import changelog from "../../../../packages/formsnap/CHANGELOG.md?raw";

	// Render the package changelog as-is: it is the single source of truth for release notes.
	const html = marked.parse(changelog, { gfm: true, async: false });
</script>

<svelte:head>
	<title>Changelog — Formsnap</title>
</svelte:head>

<div class="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
	<div class="docs-prose py-8">
		<!-- The repository's own CHANGELOG.md, rendered at build time; no user input reaches it. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html html}
	</div>
</div>
