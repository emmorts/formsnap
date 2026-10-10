<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, Description, Field, FieldErrors, Label } from "$lib/index.js";
	import RatingControl from "./rating-control.svelte";
	import type { CompositionData } from "./schema.js";

	let { data }: { data: { form: SuperValidated<CompositionData> } } = $props();

	const form = superForm(
		untrack(() => data.form),
		{ resetForm: false }
	);
	const { form: formData, enhance, message } = form;

	let nicknameLabel = $state<HTMLElement | null>(null);
	let nicknameDescription = $state<HTMLElement | null>(null);
	let ratingControl = $state<HTMLInputElement | null>(null);
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<!--
	These snippets replace the element a component renders. Spreading `props` is what keeps the
	association: it carries the id, the label's `for`, and the registration of the mounted node.
-->
{#snippet customLabel({ props }: { props: Record<string, unknown> })}
	<label {...props} data-custom="label">Nickname</label>
{/snippet}

{#snippet customDescription({ props }: { props: Record<string, unknown> })}
	<small {...props} data-custom="description">Two characters minimum.</small>
{/snippet}

{#snippet customErrors({
	props,
	errors,
	errorProps,
}: {
	props: Record<string, unknown>;
	errors: string[];
	errorProps: Record<string, unknown>;
})}
	<ul {...props} data-custom="errors">
		{#each errors as error, index (index)}
			<li {...errorProps}>{error}</li>
		{/each}
	</ul>
{/snippet}

<form method="POST" use:enhance data-testid="recipe-composition" data-hydrated={hydrated}>
	<!--
		Standalone `Description`/`FieldErrors` own only the elements they render, and associate them
		when they mount. `bind:ref` hands the actual node back to the consumer.
	-->
	<Field {form} name="nickname">
		<Control>
			{#snippet children({ props })}
				<Label child={customLabel} bind:ref={nicknameLabel} />
				<input {...props} bind:value={$formData.nickname} />
			{/snippet}
		</Control>
		<Description child={customDescription} bind:ref={nicknameDescription} />
		<FieldErrors child={customErrors} />
	</Field>

	<!--
		The `rating` field uses the owned slots instead, so its associations exist in server-rendered
		HTML even though the control itself is a custom widget.
	-->
	<Field {form} name="rating" fieldErrors>
		<Control>
			<Label>Rating</Label>
			<RatingControl bind:value={$formData.rating} bind:ref={ratingControl} />
		</Control>
		{#snippet description()}One to five stars.{/snippet}
	</Field>

	<button type="submit">Save profile</button>
</form>

<output
	data-testid="composition-refs"
	data-label={nicknameLabel?.tagName ?? ""}
	data-description={nicknameDescription?.tagName ?? ""}
	data-rating={ratingControl?.tagName ?? ""}
></output>

{#if $message}
	<output data-testid="composition-message">{$message}</output>
{/if}
