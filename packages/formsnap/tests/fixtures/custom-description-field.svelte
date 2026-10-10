<script lang="ts">
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms";
	import type { SuperValidated } from "sveltekit-superforms";
	import { Control, Field, Label } from "$lib/index.js";
	import type { SettingsData } from "../../src/routes/schema.js";
	import CustomDescription from "./custom-description.svelte";

	let { validated }: { validated: SuperValidated<SettingsData> } = $props();

	const form = superForm(untrack(() => validated));
	let show = $state(false);
</script>

<Field {form} name="email">
	<Control>
		{#snippet children({ props })}
			<Label>Email</Label>
			<input type="email" {...props} />
		{/snippet}
	</Control>
	<CustomDescription {show} />
</Field>

<button type="button" onclick={() => (show = !show)}>toggle custom help</button>
