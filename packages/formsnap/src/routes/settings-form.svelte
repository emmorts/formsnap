<script lang="ts">
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms";
	import type { SuperValidated } from "sveltekit-superforms";
	import { Control, Description, Field, FieldErrors, Label } from "$lib/index.js";
	import type { SettingsData } from "./schema.js";

	let { validated }: { validated: SuperValidated<SettingsData> } = $props();

	// `superForm` reads the initial validation data once, so the read is deliberately untracked.
	const form = superForm(untrack(() => validated));
	const { form: formData } = form;
</script>

<form method="POST">
	<Field {form} name="email">
		<Control id="email-input">
			{#snippet children({ props })}
				<Label>Email</Label>
				<input type="email" {...props} bind:value={$formData.email} />
			{/snippet}
		</Control>
		<Description>We'll email you about your account.</Description>
		<FieldErrors />
	</Field>

	<Field {form} name="bio">
		<Control>
			{#snippet children({ props })}
				<Label>Bio</Label>
				<textarea {...props} bind:value={$formData.bio}></textarea>
			{/snippet}
		</Control>
		<Description>Tell us about yourself.</Description>
		<FieldErrors />
	</Field>
</form>
