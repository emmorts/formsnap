<script lang="ts">
	import { untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, ElementField, Field } from "$lib/index.js";
	import type { ReactivityData } from "./reactivity-schema.js";

	let { validated }: { validated: SuperValidated<ReactivityData> } = $props();
	const form = superForm(
		untrack(() => validated),
		{ dataType: "json" }
	);
	let nestedPath = $state<"profile.name" | "profile.sibling">("profile.name");
	let arrayPath = $state<"rows[0].name" | "rows[1].name">("rows[0].name");
	let mutation = $state("");

	export function stores() {
		return form;
	}

	export function switchPaths() {
		nestedPath = nestedPath === "profile.name" ? "profile.sibling" : "profile.name";
		arrayPath = arrayPath === "rows[0].name" ? "rows[1].name" : "rows[0].name";
	}

	type Received = { errors: string[]; tainted: boolean; constraints: Record<string, unknown> };
	function mutate(id: string, state: Received) {
		state.errors.push(`consumer ${id}`);
		state.constraints.required = false;
		// A nested child must be copied as well, not just the selected constraint object's shell.
		const child = state.constraints.name;
		if (child && typeof child === "object") {
			(child as Record<string, unknown>).minlength = 999;
		}
		mutation = JSON.stringify({ id, errors: state.errors, constraints: state.constraints });
	}
</script>

{#snippet received(id: string, state: Received)}
	<output
		data-view={id}
		data-errors={JSON.stringify(state.errors)}
		data-tainted={String(state.tainted)}
		data-constraints={JSON.stringify(state.constraints)}
	></output>
	<Control>
		{#snippet children({ props })}
			<input {...props} data-control={id} />
		{/snippet}
	</Control>
	<button type="button" data-mutate={id} onclick={() => mutate(id, state)}>Mutate copies</button>
{/snippet}

<Field {form} name={nestedPath}>
	{#snippet children(state)}
		{@render received("nested", state)}
	{/snippet}
</Field>
<Field {form} name={arrayPath}>
	{#snippet children(state)}
		{@render received("array", state)}
	{/snippet}
</Field>
<Field {form} name="rows">
	<ElementField {form} name={arrayPath}>
		{#snippet children(state)}
			{@render received("element", state)}
		{/snippet}
	</ElementField>
</Field>
<Field {form} name="profile.sibling">
	{#snippet children(state)}
		{@render received("sibling", state)}
	{/snippet}
</Field>
<Field {form} name="profile">
	{#snippet children(state)}
		{@render received("group", state)}
	{/snippet}
</Field>
<output data-mutation>{mutation}</output>
