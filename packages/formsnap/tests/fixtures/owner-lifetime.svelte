<script lang="ts">
	import { untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, ElementField, Field, Fieldset, Label, Legend } from "$lib/index.js";
	import type { ReactivityData } from "./reactivity-schema.js";
	import OwnerLifetimeHook from "./owner-lifetime-hook.svelte";

	let {
		first,
		second,
	}: {
		first: SuperValidated<ReactivityData>;
		second: SuperValidated<ReactivityData>;
	} = $props();
	const firstForm = superForm(
		untrack(() => first),
		{ id: "owner-first", dataType: "json" }
	);
	const secondForm = superForm(
		untrack(() => second),
		{ id: "owner-second", dataType: "json" }
	);
	let currentForm = $state(firstForm);

	export function owners() {
		return { first: firstForm, second: secondForm };
	}

	export function select(owner: "first" | "second") {
		currentForm = owner === "first" ? firstForm : secondForm;
	}
</script>

{#key currentForm}
	<Field form={currentForm} name="profile.name" fieldErrors>
		{#snippet children({ value, constraints })}
			<output data-value="field" data-required={String(constraints.required)}>{value}</output>
			<OwnerLifetimeHook view="field" />
			<Control>
				{#snippet children({ props })}
					<Label>Profile name</Label>
					<input {...props} data-control="field" />
				{/snippet}
			</Control>
		{/snippet}
		{#snippet description()}The current owner's profile name.{/snippet}
	</Field>
	<Fieldset form={currentForm} name="rows" fieldErrors>
		<Legend>Rows</Legend>
		<OwnerLifetimeHook view="fieldset" />
		<ElementField form={currentForm} name="rows[0].name" fieldErrors>
			{#snippet children({ value, constraints })}
				<output data-value="element" data-required={String(constraints.required)}
					>{value}</output
				>
				<OwnerLifetimeHook view="element" />
				<Control>
					{#snippet children({ props })}
						<Label>First row</Label>
						<input {...props} data-control="element" />
					{/snippet}
				</Control>
			{/snippet}
		</ElementField>
		{#snippet description()}The current owner's rows.{/snippet}
	</Fieldset>
{/key}
