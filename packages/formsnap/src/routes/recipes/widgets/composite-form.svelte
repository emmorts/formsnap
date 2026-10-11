<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, Field } from "$lib/index.js";
	import CollectionSelect from "./collection-select.svelte";
	import type { CompositeData } from "./schema.js";

	let { validated }: { validated: SuperValidated<CompositeData> } = $props();
	const form = superForm(
		untrack(() => validated),
		{
			id: "widgets-composite",
			resetForm: false,
			invalidateAll: false,
			validationMethod: "submit-only",
			// Superforms owns submission; the trigger ref is used only by explicit user activation.
			autoFocusOnError: false,
			scrollToError: "off",
		}
	);
	const { form: formData, enhance, message, reset } = form;
	let disabled = $state(false);
	let hydrated = $state(false);
	let open = $state(false);
	let trigger = $state<HTMLButtonElement | null>(null);
	onMount(() => {
		hydrated = true;
	});

	function resetSelection() {
		open = false;
		reset();
	}
</script>

<section aria-labelledby="widgets-composite-heading">
	<h2 id="widgets-composite-heading">Bits UI composite select</h2>
	<p>
		This select requires JavaScript and is disabled until hydration. The native form remains
		usable without it. The recipe pins Bits UI 1.8.0 to support Svelte 5.30.2; current Bits UI 2
		requires Svelte 5.33.0 or newer. Bits owns keyboard navigation, typeahead and listbox ARIA;
		Formsnap supplies the trigger's label, description and server errors. The application binds
		the value to Superforms and disables both the trigger and its separate hidden transport.
	</p>
	<p>
		Closed depot is unavailable and the server rejects it even if a request bypasses the widget.
	</p>
	<label for="widgets-composite-disabled">Disable composite select</label>
	<input
		id="widgets-composite-disabled"
		type="checkbox"
		bind:checked={disabled}
		disabled={!hydrated}
		onchange={() => {
			open = false;
		}}
	/>
	<button type="button" onclick={() => trigger?.focus()} disabled={!hydrated || disabled}>
		Focus collection point
	</button>

	<form
		method="POST"
		action="?/composite"
		use:enhance
		novalidate
		data-testid="recipe-widgets-composite"
		data-hydrated={hydrated}
	>
		<Field {form} name="collection" fieldErrors>
			<Control id="widgets-collection">
				<CollectionSelect
					bind:value={$formData.collection}
					bind:open
					bind:ref={trigger}
					disabled={!hydrated || disabled}
				/>
			</Control>
			{#snippet description()}Choose an open depot for collection.{/snippet}
		</Field>
		<button type="submit" disabled={!hydrated}>Save collection point</button>
		<button type="button" onclick={resetSelection} disabled={!hydrated}
			>Reset collection point</button
		>
	</form>
	{#if $message}<output data-testid="widgets-composite-message">{$message}</output>{/if}
</section>
