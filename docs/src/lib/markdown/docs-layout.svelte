<script lang="ts">
	import { onMount } from "svelte";

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
		<meta name="description" content={description} />
	{/if}
</svelte:head>

<article class="docs-prose">
	{#if title}
		<header class="docs-prose-header">
			<h1>{title}</h1>
			{#if description}
				<p class="docs-prose-lede">{description}</p>
			{/if}
		</header>
	{/if}
	{@render children?.()}
</article>
