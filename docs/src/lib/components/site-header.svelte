<script lang="ts">
	import { onMount } from "svelte";
	import { afterNavigate } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { site } from "$lib/config";
	import Icon from "./icon.svelte";
	import ThemeToggle from "./theme-toggle.svelte";
	import SiteSidebar from "./site-sidebar.svelte";

	const instanceId = $props.id();
	const menuId = `navigation-${instanceId}`;
	let menu: HTMLDialogElement | undefined = $state();
	let closeButton: HTMLButtonElement | undefined = $state();
	let menuOpen = $state(false);

	function closeMenu() {
		menu?.close();
	}

	function openMenu() {
		menu?.showModal();
		menuOpen = true;
		closeButton?.focus();
	}

	afterNavigate(closeMenu);
	onMount(() => {
		const desktop = window.matchMedia("(min-width: 1024px)");
		const resize = () => {
			if (desktop.matches) closeMenu();
		};
		desktop.addEventListener("change", resize);
		return () => desktop.removeEventListener("change", resize);
	});
</script>

<header class="border-line bg-surface/80 sticky top-0 z-40 border-b backdrop-blur-md">
	<div class="mx-auto flex h-16 max-w-[90rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
		<button
			type="button"
			class="border-line text-fg-muted inline-flex size-9 items-center justify-center rounded-lg border lg:hidden"
			aria-label="Open navigation"
			aria-expanded={menuOpen}
			aria-controls={menuId}
			aria-haspopup="dialog"
			onclick={openMenu}
		>
			<Icon name="menu" class="size-4" />
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
			<a
				href={resolve("/docs/search")}
				aria-label="Search documentation"
				class="border-line text-fg-muted hover:text-fg rounded-lg border px-2.5 py-2 text-sm"
			>
				Search
			</a>
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
</header>

<!-- Native modal behavior keeps focus in navigation, closes on Escape, and restores its trigger. -->
<dialog
	id={menuId}
	bind:this={menu}
	aria-labelledby={`${menuId}-title`}
	onclose={() => (menuOpen = false)}
	class="border-line bg-surface text-fg fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 p-0 lg:hidden"
>
	<div class="flex h-full flex-col">
		<div class="border-line flex h-16 shrink-0 items-center justify-between border-b px-4">
			<h2 id={`${menuId}-title`} class="font-display font-semibold">Documentation</h2>
			<button
				type="button"
				bind:this={closeButton}
				aria-label="Close navigation"
				onclick={closeMenu}
				class="border-line text-fg-muted inline-flex size-9 items-center justify-center rounded-lg border"
			>
				<Icon name="close" class="size-4" />
			</button>
		</div>
		<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
			<SiteSidebar onNavigate={closeMenu} />
		</div>
	</div>
</dialog>

<noscript>
	<div class="border-line border-b px-4 py-4 lg:hidden">
		<SiteSidebar />
	</div>
</noscript>
