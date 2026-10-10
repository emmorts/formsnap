<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { zodClient } from "sveltekit-superforms/adapters";
	import { Control, Field, FieldErrors, Label } from "$lib/index.js";
	import { announcementsSchema, type AnnouncementsData } from "./schema.js";

	let { data }: { data: { form: SuperValidated<AnnouncementsData> } } = $props();

	// `zodClient` is Superforms' client-side validator: with it, an error that already exists is
	// replaced while the user types, without a request and without a navigation. That in-place
	// update is what a live region announces, and it is what the policies on this page choose
	// between. Without JavaScript the same schema validates in the action instead.
	const form = superForm(
		untrack(() => data.form),
		{
			validators: zodClient(announcementsSchema),
			validationMethod: "oninput",
			resetForm: false,
		}
	);
	const { form: formData, enhance } = form;

	// A freely composed region can be rendered conditionally; its association follows the element.
	let showNoteErrors = $state(true);
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<form method="POST" use:enhance data-testid="recipe-announcements" data-hydrated={hydrated}>
	<!-- Owned region, default policy: `aria-live="assertive"`. -->
	<Field {form} name="username" fieldErrors>
		<Control>
			{#snippet children({ props })}
				<Label>Username</Label>
				<input {...props} bind:value={$formData.username} />
			{/snippet}
		</Control>
		{#snippet description()}The owned region keeps the default assertive policy.{/snippet}
	</Field>

	<!-- Owned region with an explicit policy, declared by the scope that renders it. -->
	<Field {form} name="nickname" fieldErrors fieldErrorsLive="polite">
		<Control>
			{#snippet children({ props })}
				<Label>Nickname</Label>
				<input {...props} bind:value={$formData.nickname} />
			{/snippet}
		</Control>
		{#snippet description()}A polite region waits for the user to pause before it announces.{/snippet}
	</Field>

	<!-- A standalone region decides its own policy, and is only associated while it is rendered. -->
	<Field {form} name="note">
		<Control>
			{#snippet children({ props })}
				<Label>Note</Label>
				<input {...props} bind:value={$formData.note} />
			{/snippet}
		</Control>
		{#snippet description()}Off: nothing announces the error, and the region is associated once
			it mounts.{/snippet}
		{#if showNoteErrors}
			<FieldErrors live="off" />
		{/if}
	</Field>

	<label for="announcements-note-errors">Render the note's error region</label>
	<input
		id="announcements-note-errors"
		type="checkbox"
		name="note-errors-toggle"
		bind:checked={showNoteErrors}
	/>

	<button type="submit">Save profile</button>
</form>
