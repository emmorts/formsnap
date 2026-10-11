<script lang="ts">
	import { page } from "$app/state";
	import { navigation } from "$lib/config";

	let { onNavigate }: { onNavigate?: () => void } = $props();

	const isActive = (href: string) => page.url.pathname === href;
</script>

<nav aria-label="Documentation" class="flex flex-col gap-6">
	{#each navigation as section (section.title)}
		<div>
			<p class="text-fg-subtle mb-2 px-3 text-xs font-medium uppercase tracking-wider">
				{section.title}
			</p>
			<ul class="flex flex-col gap-0.5">
				{#each section.items as item (item.href)}
					{@const active = isActive(item.href)}
					<li>
						<!-- Hrefs are pre-resolved in $lib/config; resolve() is not called again here. -->
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href={item.href}
							aria-current={active ? "page" : undefined}
							onclick={onNavigate}
							class={[
								"block rounded-md border-l-2 px-3 py-1.5 text-sm transition-colors",
								active
									? "border-accent bg-accent-soft text-fg font-medium"
									: "text-fg-muted hover:text-fg border-transparent",
							]}
						>
							{item.title}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</nav>
