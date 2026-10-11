<script lang="ts">
	import { onMount } from "svelte";
	import { browser } from "$app/environment";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { searchDocumentation, type SearchEntry } from "$lib/search";
	import { inputClass, secondaryButtonClass } from "$lib/demos/input-classes";

	let query = $derived(browser ? (page.url.searchParams.get("q") ?? "") : "");
	let entries = $state<SearchEntry[]>([]);
	let loading = $state(true);
	let failed = $state(false);
	let resultsElement: HTMLUListElement | undefined = $state();
	const results = $derived(searchDocumentation(entries, query));

	onMount(() => {
		const controller = new AbortController();
		async function loadIndex() {
			try {
				const response = await fetch(resolve("/search-index.json"), {
					signal: controller.signal,
				});
				if (!response.ok) throw new Error(`Search index returned ${response.status}`);
				entries = await response.json();
			} catch {
				if (!controller.signal.aborted) failed = true;
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		}
		void loadIndex();
		return () => controller.abort();
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		void goto(resolve(`/docs/search?q=${encodeURIComponent(query.trim())}`), {
			keepFocus: true,
			noScroll: true,
		});
	}
</script>

<svelte:head>
	<title>Search documentation — Formsnap</title>
	<meta
		name="description"
		content="Find Formsnap components, headless hooks, guides and recipes by page or section."
	/>
</svelte:head>

<div class="max-w-[46rem]">
	<h1 class="font-display text-fg text-3xl font-semibold tracking-tight">Search documentation</h1>
	<p class="text-fg-muted mt-3 leading-relaxed">
		Search components, hooks, guides and recipes. Results link directly to the matching section.
		Matching runs in your browser against a static index; no external search service is used.
	</p>
	<form
		role="search"
		action={resolve("/docs/search")}
		method="GET"
		onsubmit={submit}
		class="mt-6 flex flex-col gap-2"
	>
		<label for="docs-search" class="text-fg text-sm font-medium">Search terms</label>
		<div class="flex gap-2">
			<input
				id="docs-search"
				name="q"
				type="search"
				bind:value={query}
				class={inputClass}
				placeholder="For example: array errors, useFormField, SSR"
				aria-describedby="search-help"
				onkeydown={(event) => {
					if (event.key === "ArrowDown" && results.length) {
						event.preventDefault();
						resultsElement?.querySelector<HTMLAnchorElement>("a")?.focus();
					}
				}}
			/>
			<button type="submit" class={secondaryButtonClass}>Search</button>
		</div>
		<p id="search-help" class="text-fg-subtle text-sm">
			All words must match. Press ↓ to focus the first result, then Tab to move between links.
			Enter saves a shareable query URL.
		</p>
	</form>
	<noscript
		><p class="text-fg-muted mt-4">
			Search needs JavaScript. The documentation navigation remains available without it.
		</p></noscript
	>

	<p role="status" class="text-fg-muted mt-6 text-sm">
		{#if failed}
			The search index could not be loaded. Reload this page to try again, or use the
			documentation navigation.
		{:else if loading}
			Loading the search index…
		{:else if query.trim()}
			{results.length} matching section{results.length === 1 ? "" : "s"}{results.length > 30
				? "; showing the first 30"
				: ""}.
		{:else}
			Enter a component name, API, or task to find its documentation.
		{/if}
	</p>
	{#if !loading && !failed}
		<ul bind:this={resultsElement} class="mt-4 flex flex-col gap-3">
			{#each results.slice(0, 30) as result (result.href)}
				<li class="border-line rounded-lg border p-4">
					<!-- Index URLs already contain the deployment base path. -->
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={result.href} class="text-accent hover:text-accent-strong font-medium">
						{result.section || result.title}
					</a>
					{#if result.section}<p class="text-fg-subtle mt-1 text-xs">
							{result.title}
						</p>{/if}
					<p class="text-fg-muted mt-2 text-sm leading-relaxed">
						{result.text.slice(0, 220)}{result.text.length > 220 ? "…" : ""}
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</div>
