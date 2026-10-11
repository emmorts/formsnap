<script lang="ts">
	import { browser } from "$app/environment";
	import { getAllContexts, untrack, type ComponentProps } from "svelte";
	import { render as renderServer } from "svelte/server";
	import ContextMisuse from "../../../tests/fixtures/context-misuse.svelte";
	import type { PageData } from "./$types.js";

	let { data }: { data: PageData } = $props();
	const failure = browser
		? null
		: untrack(() => {
				try {
					// Retain SvelteKit's real request stores: Superforms 2 reads them during SSR.
					void renderServer(ContextMisuse, {
						props: {
							kind: data.kind as ComponentProps<typeof ContextMisuse>["kind"],
							validated: data.form,
						},
						context: getAllContexts(),
					}).body;
					return null;
				} catch (error) {
					if (!(error instanceof Error)) throw error;
					return { type: error.name, message: error.message };
				}
			});
</script>

{#if failure}
	<output data-context-error data-error-type={failure.type}>{failure.message}</output>
{/if}
