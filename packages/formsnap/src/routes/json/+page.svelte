<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, ElementField, Field, Fieldset, Label, Legend } from "$lib/index.js";
	import type { ContactsData } from "./schema.js";

	let { data }: { data: { form: SuperValidated<ContactsData> } } = $props();
	let response = $state<SuperValidated<ContactsData> | undefined>();
	let updates = $state(0);
	const form = superForm(
		untrack(() => data.form),
		{
			dataType: "json",
			resetForm: false,
			validators: false,
			onUpdated({ form: result }) {
				response = result;
				updates += 1;
			},
		}
	);
	const { form: formData, enhance } = form;
	// Superforms can replace row objects during taint updates; object identity is not a stable key.
	const initialRowCount = untrack(() => data.form.data.contacts.length);
	let rowIds = $state(Array.from({ length: initialRowCount }, (_, index) => index));
	let nextRowId = initialRowCount;

	function addRow() {
		rowIds = [...rowIds, nextRowId++];
		$formData.contacts = [...$formData.contacts, { email: "added@example.com" }];
	}

	function reorderRows() {
		rowIds = [...rowIds].reverse();
		$formData.contacts = [...$formData.contacts].reverse();
	}

	function removeRow() {
		rowIds = rowIds.slice(0, -1);
		$formData.contacts = $formData.contacts.slice(0, -1);
	}
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<form method="POST" use:enhance data-hydrated={hydrated} novalidate>
	<Field {form} name="profile.name" fieldErrors>
		{#snippet children({ value })}
			<output data-testid="profile-value" data-value={JSON.stringify(value)}>{value}</output>
			<Control>
				{#snippet children({ props })}
					<Label>Profile name</Label>
					<input {...props} bind:value={$formData.profile.name} />
				{/snippet}
			</Control>
		{/snippet}
		{#snippet description()}Use at least two characters.{/snippet}
	</Field>
	<Fieldset {form} name="contacts" fieldErrors>
		<Legend>Contacts</Legend>
		{#snippet description()}Enter an email address for each contact.{/snippet}
		{#each $formData.contacts as _, index (rowIds[index])}
			<div data-row={index}>
				<ElementField
					{form}
					name={`contacts[${index}].email` as `contacts[${number}].email`}
					fieldErrors
				>
					{#snippet children({ value, tainted })}
						<output data-value={JSON.stringify(value)} data-tainted={tainted}
							>{value}</output
						>
						<Control>
							{#snippet children({ props })}
								<Label>Contact {index + 1}</Label>
								<input {...props} bind:value={$formData.contacts[index].email} />
							{/snippet}
						</Control>
					{/snippet}
				</ElementField>
			</div>
		{/each}
	</Fieldset>
	<button type="button" onclick={addRow}>Add row</button>
	<button type="button" onclick={reorderRows}>Reorder rows</button>
	<button type="button" onclick={removeRow}>Remove row</button>
	<button type="submit">Save contacts</button>
</form>

<output data-testid="updates">{updates}</output>
{#if response}
	<output data-testid="submission-data">{JSON.stringify(response.data)}</output>
	<output data-testid="submission-errors">{JSON.stringify(response.errors)}</output>
	<output data-testid="submission-valid">{JSON.stringify(response.valid)}</output>
{/if}
