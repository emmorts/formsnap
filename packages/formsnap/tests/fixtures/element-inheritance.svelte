<script lang="ts">
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms";
	import type { SuperValidated } from "sveltekit-superforms";
	import { Control, Description, ElementField, Field, Label } from "$lib/index.js";
	import type { UrlsData } from "./urls-schema.js";
	import AssociationContribution from "./association-contribution.svelte";

	let { validated }: { validated: SuperValidated<UrlsData> } = $props();

	const form = superForm(untrack(() => validated));
	let showGroupDescription = $state(true);
	let showLocalDescription = $state(false);
	let showHeadlessDescription = $state(false);
</script>

<Field {form} name="urls">
	{#if showGroupDescription}
		<Description id="urls-help">One link per line.</Description>
	{/if}
	<ElementField {form} name="urls[0]">
		{#if showLocalDescription}
			<Description id="urls-0-help">The first link.</Description>
		{/if}
		{#if showHeadlessDescription}
			<AssociationContribution
				owner="element"
				descriptionId="urls-0-headless-help"
				errorsId={null}
			/>
			<p id="urls-0-headless-help">Custom first link help</p>
		{/if}
		<Control>
			{#snippet children({ props })}
				<Label>First link</Label>
				<input {...props} />
			{/snippet}
		</Control>
	</ElementField>
	<ElementField {form} name="urls[1]">
		<Control>
			{#snippet children({ props })}
				<Label>Second link</Label>
				<input {...props} />
			{/snippet}
		</Control>
	</ElementField>
</Field>

<button type="button" onclick={() => (showGroupDescription = !showGroupDescription)}>
	toggle group description
</button>
<button type="button" onclick={() => (showLocalDescription = !showLocalDescription)}>
	toggle local description
</button>
<button type="button" onclick={() => (showHeadlessDescription = !showHeadlessDescription)}>
	toggle headless description
</button>
