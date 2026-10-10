<script lang="ts">
	import { untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, Field, FieldErrors, Label } from "$lib/index.js";
	import type { FieldErrorsLive } from "$lib/attrs.types.js";
	import type { SettingsData } from "../../src/routes/schema.js";

	let { validated }: { validated: SuperValidated<SettingsData> } = $props();
	const form = superForm(untrack(() => validated));
	let emailPolicy = $state<FieldErrorsLive>("polite");
</script>

<Field {form} name="email" fieldErrors fieldErrorsId="email-errors" fieldErrorsLive={emailPolicy}>
	<Control>
		{#snippet children({ props })}
			<Label>Email</Label>
			<input {...props} />
		{/snippet}
	</Control>
</Field>

<Field {form} name="bio">
	<Control>
		{#snippet children({ props })}
			<Label>Bio</Label>
			<textarea {...props}></textarea>
		{/snippet}
	</Control>
	<!-- Named ids let the test address the region that each policy case produces. -->
	<FieldErrors id="bio-default" />
	<FieldErrors id="bio-spread" aria-live="polite" />
	<FieldErrors id="bio-prop-wins" live="off" aria-live="polite" />
</Field>

<button type="button" onclick={() => (emailPolicy = emailPolicy === "polite" ? "off" : "polite")}>
	change owned policy
</button>
