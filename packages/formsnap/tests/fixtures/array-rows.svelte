<script lang="ts">
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms";
	import type { SuperValidated } from "sveltekit-superforms";
	import { ElementField, Field } from "$lib/index.js";
	import type { UrlsData } from "./urls-schema.js";

	let { validated }: { validated: SuperValidated<UrlsData> } = $props();

	const form = superForm(untrack(() => validated));
	const { form: formData } = form;

	/** Renders what a snippet received, so tests read the values the consumer would get. */
	const shown = (value: unknown) => (value === undefined ? "<missing>" : JSON.stringify(value));
</script>

<Field {form} name="urls">
	{#each $formData.urls as _, index (index)}
		<ElementField {form} name={`urls[${index}]` as `urls[${number}]`}>
			{#snippet children({ value })}
				<output data-row={index} data-value={shown(value)}></output>
			{/snippet}
		</ElementField>
	{/each}
</Field>

<button
	type="button"
	onclick={() => ($formData.urls = [...$formData.urls, "https://added.example"])}
>
	add row
</button>
<button type="button" onclick={() => ($formData.urls = $formData.urls.slice(0, -1))}>
	remove row
</button>
<button type="button" onclick={() => ($formData.urls = [...$formData.urls].reverse())}>
	reorder rows
</button>
