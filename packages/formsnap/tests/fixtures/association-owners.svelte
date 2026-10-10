<script lang="ts">
	import { untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, Description, Field, FieldErrors, Label } from "$lib/index.js";
	import type { SettingsData } from "../../src/routes/schema.js";
	import AssociationContribution from "./association-contribution.svelte";

	let { validated }: { validated: SuperValidated<SettingsData> } = $props();
	const form = superForm(untrack(() => validated));
	let active = $state(true);
	let showSharedOwner = $state(true);
	let showUniqueOwner = $state(true);
	let showComponents = $state(true);
	let combineUniqueAssociations = $state(false);
	let uniqueId = $state("unique-help");
</script>

<Field {form} name="email">
	<Control id="owned-email">
		{#snippet children({ props })}
			<Label>Email</Label>
			<input {...props} />
		{/snippet}
	</Control>
	{#if showComponents}
		<Description id="shared-help">Shared help</Description>
		<FieldErrors id="shared-errors" />
	{:else}
		<p id="shared-help">Shared help</p>
		<div id="shared-errors">Shared errors</div>
	{/if}
	<p id={uniqueId}>Unique help</p>
	<div id="unique-errors">Unique errors</div>
	{#if showSharedOwner}
		<AssociationContribution
			owner="shared"
			descriptionId={active ? "shared-help" : null}
			errorsId={active ? "shared-errors" : null}
		/>
	{/if}
	{#if showUniqueOwner}
		<AssociationContribution
			owner="unique"
			descriptionId={uniqueId}
			errorsId={combineUniqueAssociations ? uniqueId : "unique-errors"}
		/>
	{/if}
</Field>

<button type="button" onclick={() => (active = !active)}>release shared owner</button>
<button type="button" onclick={() => (showSharedOwner = !showSharedOwner)}>
	toggle shared owner
</button>
<button type="button" onclick={() => (showUniqueOwner = !showUniqueOwner)}>
	toggle unique owner
</button>
<button type="button" onclick={() => (showComponents = !showComponents)}>
	toggle contributing components
</button>
<button type="button" onclick={() => (combineUniqueAssociations = !combineUniqueAssociations)}>
	combine unique associations
</button>
<button type="button" onclick={() => (uniqueId = "renamed-unique-help")}>
	rename unique hook help
</button>
