<script lang="ts">
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms";
	import type { SuperValidated } from "sveltekit-superforms";
	import { Control, ElementField, Field, Fieldset, Label, Legend } from "$lib/index.js";
	import type { PathsData } from "./paths-schema.js";

	let { validated }: { validated: SuperValidated<PathsData> } = $props();

	// Nested objects need the JSON data type in Superforms.
	const form = superForm(
		untrack(() => validated),
		{ dataType: "json" }
	);
	const { form: formData } = form;

	/** Renders what a snippet received, so tests read the values the consumer would get. */
	const shown = (value: unknown) => (value === undefined ? "<missing>" : JSON.stringify(value));

	let which = $state<"profile.name" | "items[0].id">("profile.name");
</script>

<Field {form} name="profile.name">
	{#snippet children({ value, errors, tainted, constraints })}
		<output
			data-path="profile.name"
			data-value={shown(value)}
			data-errors={JSON.stringify(errors)}
			data-tainted={String(tainted)}
			data-constraints={JSON.stringify(constraints)}
		></output>
		<Control>
			{#snippet children({ props })}
				<Label>Name</Label>
				<input {...props} bind:value={$formData.profile.name} />
			{/snippet}
		</Control>
	{/snippet}
</Field>

<Field {form} name="urls[0]">
	{#snippet children({ value, errors, constraints })}
		<output
			data-path="urls[0]"
			data-value={shown(value)}
			data-errors={JSON.stringify(errors)}
			data-constraints={JSON.stringify(constraints)}
		></output>
	{/snippet}
</Field>

<Field {form} name="items[0].id">
	{#snippet children({ value, constraints })}
		<output
			data-path="items[0].id"
			data-value={shown(value)}
			data-constraints={JSON.stringify(constraints)}
		></output>
	{/snippet}
</Field>

<Field {form} name="matrix[0][1]">
	{#snippet children({ value, constraints })}
		<output
			data-path="matrix[0][1]"
			data-value={shown(value)}
			data-constraints={JSON.stringify(constraints)}
		></output>
	{/snippet}
</Field>

<Field {form} name="nickname">
	{#snippet children({ value })}
		<output data-path="nickname" data-value={shown(value)}></output>
	{/snippet}
</Field>

<Fieldset {form} name="profile">
	{#snippet children({ value })}
		<Legend>Profile</Legend>
		<output data-path="profile" data-value={shown(value)}></output>
	{/snippet}
</Fieldset>

<Field {form} name="urls">
	<ElementField {form} name="urls[0]">
		{#snippet children({ value, errors, constraints })}
			<output
				data-path="element.urls[0]"
				data-value={shown(value)}
				data-errors={JSON.stringify(errors)}
				data-constraints={JSON.stringify(constraints)}
			></output>
		{/snippet}
	</ElementField>
</Field>

<Field {form} name="items">
	<ElementField {form} name="items[0].id">
		{#snippet children({ value, constraints })}
			<output
				data-path="element.items[0].id"
				data-value={shown(value)}
				data-constraints={JSON.stringify(constraints)}
			></output>
		{/snippet}
	</ElementField>
</Field>

<Field {form} name="matrix">
	<ElementField {form} name="matrix[0][1]">
		{#snippet children({ value, constraints })}
			<output
				data-path="element.matrix[0][1]"
				data-value={shown(value)}
				data-constraints={JSON.stringify(constraints)}
			></output>
		{/snippet}
	</ElementField>
</Field>

<Field {form} name={which}>
	{#snippet children({ value, constraints })}
		<output
			data-path="switching"
			data-value={shown(value)}
			data-constraints={JSON.stringify(constraints)}
		></output>
	{/snippet}
</Field>

<Field {form} name="optionalProfile.name">
	{#snippet children({ value })}
		<output data-path="optionalProfile.name" data-value={shown(value)}></output>
	{/snippet}
</Field>
<Field {form} name="optionalUrls">
	<ElementField {form} name="optionalUrls[0]">
		{#snippet children({ value })}
			<output data-path="optionalUrls[0]" data-value={shown(value)}></output>
		{/snippet}
	</ElementField>
</Field>
<Field {form} name="codes.123">
	{#snippet children({ constraints })}
		<output data-path="codes.123" data-constraints={JSON.stringify(constraints)}></output>
	{/snippet}
</Field>
<Field {form} name="contact.email">
	{#snippet children({ value })}
		<output data-path="contact.email" data-value={shown(value)}></output>
	{/snippet}
</Field>
<Field {form} name="contact[0]">
	{#snippet children({ value, constraints })}
		<output
			data-path="contact[0]"
			data-value={shown(value)}
			data-constraints={JSON.stringify(constraints)}
		></output>
		<ElementField {form} name="contact[0]">
			{#snippet children({ value, constraints })}
				<output
					data-path="element.contact[0]"
					data-value={shown(value)}
					data-constraints={JSON.stringify(constraints)}
				></output>
			{/snippet}
		</ElementField>
	{/snippet}
</Field>

<button
	type="button"
	onclick={() => (which = which === "profile.name" ? "items[0].id" : "profile.name")}
>
	switch path
</button>
