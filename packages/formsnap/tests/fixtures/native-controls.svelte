<script lang="ts">
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms";
	import type { SuperValidated } from "sveltekit-superforms";
	import { Control, Field, FieldErrors, Fieldset, Label, Legend } from "$lib/index.js";
	import type { NativeData } from "./native-schema.js";

	let { validated }: { validated: SuperValidated<NativeData> } = $props();

	const form = superForm(untrack(() => validated));
	const { form: formData } = form;
</script>

<Field {form} name="marketing">
	<Control>
		{#snippet children({ props })}
			<input type="checkbox" {...props} bind:checked={$formData.marketing} />
			<Label>Receive marketing emails</Label>
		{/snippet}
	</Control>
	<FieldErrors />
</Field>

<Fieldset {form} name="theme">
	<Legend>Select your theme</Legend>
	{#each ["light", "dark"] as theme (theme)}
		<Control>
			{#snippet children({ props })}
				<input type="radio" value={theme} {...props} bind:group={$formData.theme} />
				<Label>{theme}</Label>
			{/snippet}
		</Control>
	{/each}
	<FieldErrors />
</Fieldset>
