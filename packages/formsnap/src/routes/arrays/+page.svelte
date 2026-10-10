<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import {
		Control,
		Description,
		ElementField,
		FieldErrors,
		Fieldset,
		Label,
		Legend,
	} from "$lib/index.js";
	import type { UrlsData } from "./schema.js";

	let {
		data,
		form: action,
	}: {
		data: { form: SuperValidated<UrlsData> };
		form?: { form: SuperValidated<UrlsData> } | null;
	} = $props();

	const validated = untrack(() => action?.form ?? data.form);
	const form = superForm(
		untrack(() => data.form),
		{ resetForm: false }
	);
	const { form: formData } = form;
	let rowIds = $state(validated.data.urls.map((_, index) => index));
	let nextRowId = validated.data.urls.length;

	function addRow() {
		rowIds = [...rowIds, nextRowId++];
		$formData.urls = [...$formData.urls, "https://added.example"];
	}

	function reorderRows() {
		rowIds = [...rowIds].reverse();
		$formData.urls = [...$formData.urls].reverse();
	}

	function removeRow() {
		rowIds = rowIds.slice(0, -1);
		$formData.urls = $formData.urls.slice(0, -1);
	}
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<form method="POST" data-hydrated={hydrated}>
	<Fieldset {form} name="urls">
		<Legend>Website URLs</Legend>
		<Description>Enter one URL per row.</Description>
		{#each $formData.urls as _, index (rowIds[index])}
			<ElementField {form} name={`urls[${index}]` as `urls[${number}]`}>
				{#snippet children({ value, tainted })}
					<div data-row={index}>
						<output data-value={JSON.stringify(value)} data-tainted={tainted}
							>{value}</output
						>
						<Control>
							{#snippet children({ props })}
								<Label>URL {index + 1}</Label>
								<input {...props} bind:value={$formData.urls[index]} />
							{/snippet}
						</Control>
						<FieldErrors />
					</div>
				{/snippet}
			</ElementField>
		{/each}
		<FieldErrors />
	</Fieldset>
	<button type="button" onclick={addRow}>Add row</button>
	<button type="button" onclick={reorderRows}>Reorder rows</button>
	<button type="button" onclick={removeRow}>Remove row</button>
	<button type="submit">Save URLs</button>
</form>

{#if validated.posted}
	<output data-testid="submission-data">{JSON.stringify(validated.data)}</output>
	<output data-testid="submission-errors">{JSON.stringify(validated.errors)}</output>
{/if}
