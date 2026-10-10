<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, Field, Label } from "$lib/index.js";
	import type { ConstraintsData } from "./schema.js";

	let { data }: { data: { form: SuperValidated<ConstraintsData> } } = $props();

	// `customValidity` copies each field's server errors onto that control's native validity
	// message, so the browser's own bubble reports the same problem as the errors region.
	const form = superForm(
		untrack(() => data.form),
		{
			customValidity: true,
			resetForm: false,
		}
	);
	const { form: formData, enhance, message } = form;
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<form method="POST" use:enhance data-testid="recipe-constraints" data-hydrated={hydrated}>
	<Field {form} name="handle" fieldErrors>
		<Control>
			{#snippet children({ props })}
				<Label>Handle</Label>
				<!--
					The browser checks these attributes before the form submits. The schema checks the
					same rules again on the server, because a request can arrive without going through
					the browser at all.
				-->
				<input
					{...props}
					required
					minlength={3}
					maxlength={12}
					pattern="[a-z0-9_]+"
					bind:value={$formData.handle}
				/>
			{/snippet}
		</Control>
		{#snippet description()}Lowercase letters, digits and underscores, 3–12 characters.{/snippet}
	</Field>

	<Field {form} name="invite" fieldErrors>
		<Control>
			{#snippet children({ props })}
				<Label>Invite code</Label>
				<!--
					`data-no-custom-validity` opts this input out of `customValidity`. The field errors
					region still reports the server error; only the native bubble stays quiet.
				-->
				<input {...props} required data-no-custom-validity bind:value={$formData.invite} />
			{/snippet}
		</Control>
		{#snippet description()}An `INV-123` shaped code, enforced on the server.{/snippet}
	</Field>

	<button type="submit">Save handle</button>
</form>

{#if $message}
	<output data-testid="constraints-message">{$message}</output>
{/if}
