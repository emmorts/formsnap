<script lang="ts">
	import { onMount } from "svelte";
	import { navigation } from "$lib/config";
	import {
		highlightSegments,
		searchDocumentation,
		type HighlightRange,
		type SearchEntry,
	} from "$lib/search";
	import {
		closeSearchPalette,
		loadSearchIndex,
		openSearchPalette,
		searchPalette,
	} from "$lib/search-palette.svelte";
	import Icon from "./icon.svelte";

	const MAX_RESULTS = 24;
	const SUGGESTION_COUNT = 6;
	const MARK_CLASS = "bg-accent/20 text-fg rounded-sm px-0.5";

	/** A rendered option: a ranked section match, or a suggested page before anything is typed. */
	type Row = {
		href: string;
		title: string;
		section: string;
		text: string;
		titleRanges: HighlightRange[];
		sectionRanges: HighlightRange[];
		textRanges: HighlightRange[];
		/** Position in the rendered list, which is also the option's ARIA position. */
		index: number;
	};

	const instanceId = $props.id();
	const listId = `search-list-${instanceId}`;
	const titleId = `search-title-${instanceId}`;
	const helpId = `search-help-${instanceId}`;

	let dialog: HTMLDialogElement | undefined = $state();
	let input: HTMLInputElement | undefined = $state();
	let entries = $state<SearchEntry[]>([]);
	let status = $state<"idle" | "loading" | "ready" | "failed">("idle");
	let active = $state(0);

	function rankResults(entries: SearchEntry[], query: string) {
		const outcome = searchDocumentation(entries, query);
		const rows: Row[] = [];
		for (const result of outcome.results.slice(0, MAX_RESULTS)) {
			rows.push({
				href: result.entry.href,
				title: result.entry.title,
				section: result.entry.section,
				text: result.snippet,
				titleRanges: result.titleRanges,
				sectionRanges: result.sectionRanges,
				textRanges: result.snippetRanges,
				index: 0,
			});
		}
		// `complete: false` means nothing matched every word, so these are related sections.
		return { rows, related: !outcome.complete, total: outcome.results.length };
	}

	/** An empty query offers the documentation's own navigation order rather than an empty panel. */
	function suggestPages(entries: SearchEntry[]) {
		const pages = new Map(
			entries.filter((entry) => !entry.section).map((entry) => [entry.href, entry])
		);
		const rows: Row[] = [];
		for (const section of navigation) {
			for (const item of section.items) {
				if (rows.length >= SUGGESTION_COUNT) break;
				rows.push({
					href: item.href,
					title: item.title,
					section: "",
					text: pages.get(item.href)?.text.slice(0, 160) ?? "",
					titleRanges: [],
					sectionRanges: [],
					textRanges: [],
					index: 0,
				});
			}
			if (rows.length >= SUGGESTION_COUNT) break;
		}
		return rows;
	}

	const listing = $derived(
		searchPalette.query.trim()
			? rankResults(entries, searchPalette.query)
			: { rows: suggestPages(entries), related: false, total: 0 }
	);
	const groups = $derived(groupRows(listing.rows));
	const options = $derived(groups.flatMap((group) => group.rows));
	const statusLine = $derived(statusText());

	/** Grouping keeps each page's matches together while the groups stay in rank order. */
	function groupRows(rows: Row[]): { title: string; rows: Row[] }[] {
		const groups: { title: string; rows: Row[] }[] = [];
		for (const row of rows) {
			const last = groups.at(-1);
			if (last && last.title === row.title) last.rows.push(row);
			else groups.push({ title: row.title, rows: [row] });
		}
		// Positions are assigned after grouping: the DOM order is what ARIA and the arrow keys follow.
		let index = 0;
		for (const group of groups) {
			for (const row of group.rows) row.index = index++;
		}
		return groups;
	}

	function statusText(): string {
		if (status === "loading" && !entries.length) return "Loading the search index…";
		if (status === "failed") return "The search index could not be loaded.";
		const query = searchPalette.query.trim();
		if (!query) return `${listing.rows.length} suggested pages`;
		if (!listing.total) return `No section matches “${query}”`;
		const sections = `${listing.total} ${listing.total === 1 ? "section" : "sections"}`;
		if (listing.related)
			return `No section matches every word — showing related matches: ${sections}`;
		return listing.total > listing.rows.length
			? `${sections}, first ${listing.rows.length} shown`
			: sections;
	}

	async function ensureIndex() {
		if (status === "ready" || status === "loading") return;
		status = "loading";
		try {
			entries = await loadSearchIndex();
			status = "ready";
		} catch {
			status = "failed";
		}
	}

	function onInputKeydown(event: KeyboardEvent) {
		const count = options.length;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			if (!count) return;
			event.preventDefault();
			active =
				event.key === "ArrowDown" ? (active + 1) % count : (active - 1 + count) % count;
			return;
		}
		if (event.key === "Home" && count) {
			event.preventDefault();
			active = 0;
			return;
		}
		if (event.key === "End" && count) {
			event.preventDefault();
			active = count - 1;
			return;
		}
		if (event.key === "Enter") {
			const row = options[active];
			if (!row) return;
			event.preventDefault();
			// Activating the real anchor keeps SvelteKit's client-side navigation and middle-click.
			dialog
				?.querySelector<HTMLAnchorElement>(`#search-option-${instanceId}-${row.index}`)
				?.click();
		}
	}

	$effect(() => {
		if (searchPalette.open) {
			if (dialog && !dialog.open) {
				dialog.showModal();
				input?.focus();
				input?.select();
				void ensureIndex();
			}
		} else if (dialog?.open) {
			dialog.close();
		}
	});

	// A new query restarts the keyboard position at the strongest match.
	$effect(() => {
		searchPalette.query;
		active = 0;
	});

	// Keep the highlighted option in view as the arrow keys move through the list.
	$effect(() => {
		const row = options[active];
		if (!row) return;
		dialog
			?.querySelector(`#search-option-${instanceId}-${row.index}`)
			?.scrollIntoView({ block: "nearest" });
	});

	onMount(() => {
		const onKeydown = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
			event.preventDefault();
			if (searchPalette.open) closeSearchPalette();
			else openSearchPalette();
		};
		window.addEventListener("keydown", onKeydown);

		// Warm the index while the browser is idle, so the first open is already instant.
		const idle =
			typeof window.requestIdleCallback === "function"
				? window.requestIdleCallback(() => void ensureIndex(), { timeout: 2000 })
				: undefined;

		return () => {
			window.removeEventListener("keydown", onKeydown);
			if (idle !== undefined) window.cancelIdleCallback(idle);
		};
	});
</script>

<!-- Native modal behavior: top layer, focus contained in the panel, Escape closes, focus restored. -->
<dialog
	bind:this={dialog}
	aria-labelledby={titleId}
	onclose={closeSearchPalette}
	class="border-line bg-surface text-fg fixed left-1/2 top-6 m-0 max-h-[min(40rem,calc(100dvh-3rem))] w-[min(44rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border p-0 shadow-2xl backdrop:bg-black/40 flex"
>
	<h2 id={titleId} class="sr-only">Search documentation</h2>

	<div class="border-line flex items-center gap-2 border-b px-3">
		<Icon name="search" class="text-fg-subtle size-4 shrink-0" />
		<input
			bind:this={input}
			bind:value={searchPalette.query}
			type="search"
			role="combobox"
			aria-expanded="true"
			aria-controls={listId}
			aria-autocomplete="list"
			aria-activedescendant={options[active]
				? `search-option-${instanceId}-${options[active].index}`
				: undefined}
			aria-describedby={helpId}
			aria-label="Search documentation"
			placeholder="Search components, hooks, guides and recipes"
			autocomplete="off"
			spellcheck="false"
			class="text-fg placeholder:text-fg-subtle h-14 w-full bg-transparent text-base outline-none"
			onkeydown={onInputKeydown}
		/>
		<button
			type="button"
			onclick={closeSearchPalette}
			aria-label="Close search"
			class="border-line text-fg-muted hover:text-fg inline-flex size-8 shrink-0 items-center justify-center rounded-lg border"
		>
			<Icon name="close" class="size-4" />
		</button>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto p-2">
		{#if status === "failed"}
			<p class="text-fg-muted p-4 text-sm">
				The search index could not be loaded.
				<button type="button" onclick={ensureIndex} class="text-accent underline"
					>Try again</button
				>
			</p>
		{:else if !options.length}
			<p class="text-fg-muted p-4 text-sm">
				{searchPalette.query.trim()
					? `No section matches “${searchPalette.query.trim()}”. Try fewer words.`
					: "Type a component, hook, guide or recipe to search the documentation."}
			</p>
		{:else}
			<div id={listId} role="listbox" aria-label="Search results">
				{#each groups as group (`${group.title}-${group.rows[0].href}`)}
					<p
						role="presentation"
						class="text-fg-subtle px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide"
					>
						{group.title}
					</p>
					{#each group.rows as row (row.href)}
						<!-- Index URLs already contain the deployment base path. -->
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							id={`search-option-${instanceId}-${row.index}`}
							role="option"
							aria-selected={row.index === active}
							href={row.href}
							tabindex="-1"
							onclick={closeSearchPalette}
							onmouseenter={() => (active = row.index)}
							class="hover:bg-surface-raised block rounded-lg px-3 py-2 {row.index ===
							active
								? 'bg-surface-raised'
								: ''}"
						>
							<span class="text-fg block text-sm font-medium">
								{#each highlightSegments(row.section || row.title, row.section ? row.sectionRanges : row.titleRanges) as segment, position (position)}{#if segment.match}<mark
											class={MARK_CLASS}>{segment.text}</mark
										>{:else}{segment.text}{/if}{/each}
							</span>
							{#if row.section}
								<span class="text-fg-subtle mt-0.5 block text-xs">{row.title}</span>
							{/if}
							{#if row.text}
								<span class="text-fg-muted mt-1 block text-sm leading-relaxed">
									{#each highlightSegments(row.text, row.textRanges) as segment, position (position)}{#if segment.match}<mark
												class={MARK_CLASS}>{segment.text}</mark
											>{:else}{segment.text}{/if}{/each}
								</span>
							{/if}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/each}
				{/each}
			</div>
		{/if}
	</div>

	<div
		class="border-line text-fg-subtle flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs"
	>
		<p role="status" class="m-0">{statusLine}</p>
		<p id={helpId} class="m-0 hidden items-center gap-3 sm:flex">
			<span
				><kbd class="border-line rounded border px-1">↑</kbd><kbd
					class="border-line ml-0.5 rounded border px-1">↓</kbd
				> navigate</span
			>
			<span><kbd class="border-line rounded border px-1">↵</kbd> open</span>
			<span><kbd class="border-line rounded border px-1">esc</kbd> close</span>
		</p>
	</div>
</dialog>
