<script lang="ts">
	// Inline icon set: the site needs a handful of icons, and pulling a full icon package would
	// make Vite transform thousands of unused modules at build time. Stroke icons use a 1.75
	// width on a 24×24 grid; brand icons are filled paths.

	type IconName =
		| "sun"
		| "moon"
		| "github"
		| "menu"
		| "close"
		| "search"
		| "info"
		| "tip"
		| "warning"
		| "arrow-right";

	let { name, class: className = "" }: { name: IconName; class?: string } = $props();

	const strokes: Record<Exclude<IconName, "github">, string[]> = {
		sun: [
			'<circle cx="12" cy="12" r="4" />',
			'<path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />',
		],
		moon: ['<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />'],
		menu: ['<path d="M4 7h16M4 12h16M4 17h16" />'],
		close: ['<path d="M6 6l12 12M18 6L6 18" />'],
		info: [
			'<circle cx="12" cy="12" r="9" />',
			'<path d="M12 11v5" />',
			'<circle cx="12" cy="8" r="0.5" fill="currentColor" />',
		],
		tip: [
			'<path d="M9 18h6M10 21h4" />',
			'<path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z" />',
		],
		warning: [
			'<path d="M12 4 2.5 20h19L12 4Z" stroke-linejoin="round" />',
			'<path d="M12 10v4" />',
			'<circle cx="12" cy="17" r="0.5" fill="currentColor" />',
		],
		"arrow-right": ['<path d="M4 12h16m-6-6 6 6-6 6" />'],
		search: ['<circle cx="11" cy="11" r="7" />', '<path d="m16.5 16.5 4 4" />'],
	};

	const githubPath =
		"M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z";
</script>

{#if name === "github"}
	<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class={className}>
		<path d={githubPath} />
	</svg>
{:else}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.75"
		stroke-linecap="round"
		aria-hidden="true"
		class={className}
	>
		<!-- Static path data from the local `strokes` map; no external input. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html strokes[name].join("")}
	</svg>
{/if}
