<script lang="ts">
	import { untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, ElementField, Field } from "$lib/index.js";
	import type { FsSuperForm } from "$lib/components/types.js";
	import type { ReactivityData } from "./reactivity-schema.js";

	let { validated }: { validated: SuperValidated<ReactivityData> } = $props();
	const form = superForm(
		untrack(() => validated),
		{ dataType: "json" }
	);
	// Field presentation also accepts a form wrapper without the optional SDK method.
	const fieldForm = { ...form, isTainted: undefined };
	// A dynamically named form presents an array item's selected object subtree.
	const dynamicForm = fieldForm as unknown as FsSuperForm<Record<string, unknown>>;
	let nestedPath = $state<"profile.name" | "profile.sibling">("profile.name");
	let arrayPath = $state<"rows[0].name" | "rows[1].name">("rows[0].name");
	let groupPath = $state<"profile" | "rows">("profile");
	let itemPath = $state<"rows[0]" | "rows[1]">("rows[0]");
	let mutation = $state("");

	export function stores() {
		return form;
	}

	export function switchPaths() {
		nestedPath = nestedPath === "profile.name" ? "profile.sibling" : "profile.name";
		arrayPath = arrayPath === "rows[0].name" ? "rows[1].name" : "rows[0].name";
		itemPath = itemPath === "rows[0]" ? "rows[1]" : "rows[0]";
	}

	export function switchGroupPath() {
		groupPath = groupPath === "profile" ? "rows" : "profile";
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

<Field form={fieldForm} name={nestedPath}>
	{#snippet children(state)}
		{@render received("nested", state)}
	{/snippet}
</Field>
<Field form={fieldForm} name={arrayPath}>
	{#snippet children(state)}
		{@render received("array", state)}
	{/snippet}
</Field>
<Field form={fieldForm} name="rows">
	{#snippet children(state)}
		{@render received("array-group", state)}
		<ElementField form={fieldForm} name={arrayPath}>
			{#snippet children(state)}
				{@render received("element", state)}
			{/snippet}
		</ElementField>
		<ElementField form={dynamicForm} name={itemPath}>
			{#snippet children(state)}
				{@render received("element-group", state)}
			{/snippet}
		</ElementField>
	{/snippet}
</Field>
<Field form={fieldForm} name="profile.sibling">
	{#snippet children(state)}
		{@render received("sibling", state)}
	{/snippet}
</Field>
<Field form={fieldForm} name="profile">
	{#snippet children(state)}
		{@render received("group", state)}
	{/snippet}
</Field>
<Field form={fieldForm} name={groupPath}>
	{#snippet children(state)}
		{@render received("selected-group", state)}
	{/snippet}
</Field>
<output data-mutation>{mutation}</output>
