<script lang="ts">
	import { resolve } from "$app/paths";
	import { site } from "$lib/config";
	import Icon from "./icon.svelte";
	import ThemeToggle from "./theme-toggle.svelte";
	import SiteSidebar from "./site-sidebar.svelte";

	let menuOpen = $state(false);
</script>

<header class="border-line bg-surface/80 sticky top-0 z-40 border-b backdrop-blur-md">
	<div class="mx-auto flex h-16 max-w-[90rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
		<button
			type="button"
			class="border-line text-fg-muted inline-flex size-9 items-center justify-center rounded-lg border lg:hidden"
			aria-label={menuOpen ? "Close navigation" : "Open navigation"}
			aria-expanded={menuOpen}
			onclick={() => (menuOpen = !menuOpen)}
		>
			{#if menuOpen}
				<Icon name="close" class="size-4" />
			{:else}
				<Icon name="menu" class="size-4" />
			{/if}
		</button>

		<a href={resolve("/")} class="flex items-baseline gap-2" aria-label="{site.name}, home">
			<span class="font-display text-fg text-lg font-semibold tracking-tight">
				form<span class="text-accent">snap</span>
			</span>
		</a>

		<nav class="ml-6 hidden items-center gap-1 md:flex" aria-label="Primary">
			<a
				href={resolve("/docs")}
				class="text-fg-muted hover:text-fg rounded-md px-3 py-1.5 text-sm transition-colors"
			>
				Docs
			</a>
			<a
				href={resolve("/docs/recipes/nested-data")}
				class="text-fg-muted hover:text-fg rounded-md px-3 py-1.5 text-sm transition-colors"
			>
				Recipes
			</a>
			<a
				href={resolve("/changelog")}
				class="text-fg-muted hover:text-fg rounded-md px-3 py-1.5 text-sm transition-colors"
			>
				Changelog
			</a>
		</nav>

		<div class="ml-auto flex items-center gap-2">
			<!-- Absolute external URL: resolve() applies to app routes, not to this. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={site.repoUrl}
				target="_blank"
				rel="noreferrer"
				aria-label="GitHub repository"
				class="border-line text-fg-muted hover:border-line-strong hover:text-fg inline-flex size-9 items-center justify-center rounded-lg border transition-colors"
			>
				<Icon name="github" class="size-4" />
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<ThemeToggle />
		</div>
	</div>

	{#if menuOpen}
		<div class="border-line bg-surface border-t px-4 py-4 lg:hidden">
			<SiteSidebar onNavigate={() => (menuOpen = false)} />
		</div>
	{/if}
</header>
