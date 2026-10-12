<script lang="ts">
	import { onMount } from "svelte";
	import { deploymentBase } from "$lib/deployment-base";
	import { inlineHtml, inlinePlain } from "$lib/markdown/inline";

	let {
		title,
		description,
		children,
	}: { title?: string; description?: string; children?: import("svelte").Snippet } = $props();

	// Wire up the copy buttons the highlighter renders into every code block.
	onMount(() => {
		const buttons = document.querySelectorAll<HTMLButtonElement>(".code-copy");
		const handlers = Array.from(buttons, (button) => {
			const onClick = async () => {
				const code = decodeURIComponent(button.dataset.code ?? "");
				try {
					await navigator.clipboard.writeText(code);
				} catch {
					return;
				}
				button.textContent = "Copied";
				button.classList.add("code-copy--done");
				setTimeout(() => {
					button.textContent = "Copy";
					button.classList.remove("code-copy--done");
				}, 1500);
			};
			button.addEventListener("click", onClick);
			return () => button.removeEventListener("click", onClick);
		});
		return () => handlers.forEach((off) => off());
	});
</script>

<svelte:head>
	{#if title}
		<title>{title} — Formsnap</title>
	{/if}
	{#if description}
		<meta name="description" content={inlinePlain(description)} />
	{/if}
</svelte:head>

<article class="docs-prose">
	{#if title}
		<header class="docs-prose-header">
			<h1>{title}</h1>
			{#if description}
				<!-- inlineHtml escapes every text leaf and drops raw HTML, so repository Markdown cannot
				     inject markup here; see $lib/markdown/inline.ts. -->
				<p class="docs-prose-lede">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html inlineHtml(description, { base: deploymentBase })}
				</p>
			{/if}
		</header>
	{/if}
	{@render children?.()}
</article>
