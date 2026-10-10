<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, Field, Label } from "$lib/index.js";
	import type { FeedbackData } from "./schema.js";

	let { data }: { data: { form: SuperValidated<FeedbackData> } } = $props();

	const form = superForm(
		untrack(() => data.form),
		{ resetForm: false }
	);
	// `submitting` is Superforms' own store for an in-flight enhanced submission; the message is
	// set by the action and rendered without any subscription of Formsnap's own.
	const { form: formData, enhance, message, submitting } = form;
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<form method="POST" use:enhance data-testid="recipe-feedback" data-hydrated={hydrated}>
	<Field {form} name="answer" fieldErrors>
		<Control>
			{#snippet children({ props })}
				<Label>Answer</Label>
				<input {...props} bind:value={$formData.answer} />
			{/snippet}
		</Control>
		{#snippet description()}Pending state and confirmation both come from Superforms.{/snippet}
	</Field>

	<button type="submit" disabled={$submitting}>
		{#if $submitting}
			<span data-testid="feedback-pending">Sending…</span>
		{:else}
			Send answer
		{/if}
	</button>
</form>

{#if $message}
	<output data-testid="feedback-message">{$message}</output>
{/if}
