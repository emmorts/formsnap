<script lang="ts">
	import { onMount } from "svelte";

	type Heading = { id: string; text: string; level: number };

	let headings = $state<Heading[]>([]);
	let activeId = $state("");

	onMount(() => {
		headings = Array.from(
			document.querySelectorAll<HTMLElement>("main h2[id], main h3[id]")
		).map((el) => ({
			id: el.id,
			text: el.textContent ?? "",
			level: el.tagName === "H2" ? 2 : 3,
		}));

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) activeId = entry.target.id;
				}
			},
			{ rootMargin: "-80px 0px -70% 0px" }
		);
		for (const heading of document.querySelectorAll("main h2[id], main h3[id]")) {
			observer.observe(heading);
		}
		return () => observer.disconnect();
	});
</script>

{#if headings.length > 1}
	<nav aria-label="On this page" class="flex flex-col gap-2">
		<p class="text-fg-subtle text-xs font-medium uppercase tracking-wider">On this page</p>
		<ul class="border-line flex flex-col gap-1 border-l">
			{#each headings as heading (heading.id)}
				<li>
					<a
						href="#{heading.id}"
						class={[
							"-ml-px block border-l-2 py-1 text-sm transition-colors",
							heading.level === 3 ? "pl-6" : "pl-3",
							activeId === heading.id
								? "border-accent text-fg"
								: "text-fg-muted hover:text-fg border-transparent",
						]}
					>
						{heading.text}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
