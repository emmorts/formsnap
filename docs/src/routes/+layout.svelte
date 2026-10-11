<script lang="ts">
	import "../app.css";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { isDocsRoute, site } from "$lib/config";
	import SiteHeader from "$lib/components/site-header.svelte";
	import SiteSidebar from "$lib/components/site-sidebar.svelte";
	import SiteFooter from "$lib/components/site-footer.svelte";
	import TableOfContents from "$lib/components/table-of-contents.svelte";

	let { children } = $props();

	const pathname = $derived(page.url.pathname);
	// The changelog shares the documentation shell; other routes are full width.
	const shell = $derived(isDocsRoute(pathname) || pathname === resolve("/changelog"));
	// Its rail lists the version headings only, so repeated section names do not crowd it.
	const tocLevels = $derived(pathname === resolve("/changelog") ? [2] : [2, 3]);
</script>

<svelte:head>
	<title
		>{page.data.title
			? `${page.data.title} — ${site.name}`
			: `${site.name} — ${site.tagline}`}</title
	>
</svelte:head>

<a
	href="#main"
	class="focus:bg-accent focus:text-accent-contrast sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
>
	Skip to content
</a>

<SiteHeader />

{#if shell}
	<div class="mx-auto flex max-w-[90rem] gap-8 px-4 sm:px-6 lg:px-8">
		<aside
			class="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto py-8 pr-2 lg:block"
		>
			<SiteSidebar />
		</aside>
		<main id="main" tabindex="-1" class="min-w-0 flex-1 py-8">
			{@render children()}
		</main>
		<aside
			class="sticky top-16 hidden h-[calc(100vh-4rem)] w-52 shrink-0 overflow-y-auto py-8 xl:block"
		>
			<TableOfContents levels={tocLevels} />
		</aside>
	</div>
{:else}
	<main id="main" tabindex="-1">
		{@render children()}
	</main>
{/if}

<SiteFooter />
