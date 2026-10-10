<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, Field, Label } from "$lib/index.js";
	import type { UploadData } from "./schema.js";

	let { data }: { data: { form: SuperValidated<UploadData> } } = $props();

	const form = superForm(
		untrack(() => data.form),
		{ resetForm: false }
	);
	const { form: formData, enhance, message } = form;
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<!--
	`enctype="multipart/form-data"` is what makes the file input submit its contents without
	JavaScript. `use:enhance` submits the same FormData through fetch, so nothing here has to be
	written twice for the enhanced and unenhanced paths.
-->
<form
	method="POST"
	enctype="multipart/form-data"
	use:enhance
	data-testid="recipe-upload"
	data-hydrated={hydrated}
>
	<Field {form} name="title" fieldErrors>
		<Control>
			{#snippet children({ props })}
				<Label>Title</Label>
				<input {...props} bind:value={$formData.title} />
			{/snippet}
		</Control>
		{#snippet description()}Stored as text next to the uploaded file.{/snippet}
	</Field>

	<Field {form} name="attachment" fieldErrors>
		<Control>
			{#snippet children({ props })}
				<Label>Attachment</Label>
				<input {...props} type="file" accept=".txt,.md" />
			{/snippet}
		</Control>
		{#snippet description()}A text or Markdown file, at most 64 kB.{/snippet}
	</Field>

	<button type="submit">Upload</button>
</form>

{#if $message}
	<output data-testid="upload-message">{$message}</output>
{/if}
