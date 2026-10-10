<script lang="ts">
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms";
	import type { SuperValidated } from "sveltekit-superforms";
	import { Control, Description, Field, FieldErrors, Label } from "$lib/index.js";
	import type { SettingsData } from "../../src/routes/schema.js";

	let { validated }: { validated: SuperValidated<SettingsData> } = $props();

	const form = superForm(untrack(() => validated));
	let showDescription = $state(true);
	let showSecondDescription = $state(true);
	let showErrors = $state(true);
</script>

<Field {form} name="email">
	<Control>
		{#snippet children({ props })}
			<Label>Email</Label>
			<input type="email" {...props} />
		{/snippet}
	</Control>
	{#if showDescription}
		<Description>We'll email you about your account.</Description>
	{/if}
	{#if showSecondDescription}
		<Description id="email-second-help">Your address is never shared.</Description>
	{/if}
	{#if showErrors}
		<FieldErrors />
	{/if}
</Field>

<Field {form} name="bio">
	<Control>
		{#snippet children({ props })}
			<Label>Bio</Label>
			<textarea {...props}></textarea>
		{/snippet}
	</Control>
	<Description>Tell us about yourself.</Description>
	<FieldErrors />
</Field>

<button type="button" onclick={() => (showDescription = !showDescription)}
	>toggle description</button
>
<button type="button" onclick={() => (showSecondDescription = !showSecondDescription)}>
	toggle second description
</button>
<button type="button" onclick={() => (showErrors = !showErrors)}>toggle errors</button>
