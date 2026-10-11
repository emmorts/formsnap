<script lang="ts">
	import { untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import {
		Control,
		Description,
		ElementField,
		Field,
		FieldErrors,
		Label,
		Legend,
	} from "$lib/index.js";
	import ContextHook from "./context-hook.svelte";
	import type { ReactivityData } from "./reactivity-schema.js";

	let {
		kind,
		validated,
	}: {
		kind:
			| "description"
			| "errors"
			| "legend"
			| "element"
			| "control"
			| "label"
			| "field-hook"
			| "control-hook";
		validated: SuperValidated<ReactivityData>;
	} = $props();
	const form = superForm(
		untrack(() => validated),
		{ dataType: "json" }
	);
</script>

{#if kind === "description"}
	<Description>Help without a field</Description>
{:else if kind === "errors"}
	<FieldErrors />
{:else if kind === "legend"}
	<Legend>Legend without a group</Legend>
{:else if kind === "element"}
	<ElementField {form} name="rows[0].name">
		{#snippet children({ errors })}
			<output>{JSON.stringify(errors)}</output>
		{/snippet}
	</ElementField>
{:else if kind === "control"}
	<Control>
		{#snippet children({ props })}
			<input {...props} />
		{/snippet}
	</Control>
{:else if kind === "label"}
	<Field {form} name="profile.name">
		<Label>Label inside Field but without Control</Label>
	</Field>
{:else if kind === "field-hook"}
	<ContextHook kind="field" />
{:else if kind === "control-hook"}
	<Field {form} name="profile.name">
		<ContextHook kind="control" />
	</Field>
{/if}
