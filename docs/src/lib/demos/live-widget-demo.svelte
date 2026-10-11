<script lang="ts">
	import { onMount } from "svelte";
	import { Control, Field } from "@emmorts/formsnap";
	import { superForm } from "sveltekit-superforms";
	import { zodClient } from "sveltekit-superforms/adapters";
	import { z } from "zod/v3";
	import CollectionSelect from "./live-collection-select.svelte";
	import {
		demoBoxClass,
		errorClass,
		fieldClass,
		hintClass,
		labelClass,
		secondaryButtonClass,
		submitClass,
	} from "./input-classes";

	const prefix = $props.id();
	const schema = z.object({
		collection: z
			.string()
			.min(1, "Choose a collection point.")
			.refine(
				(value) => value === "" || value === "central" || value === "east",
				"Choose an open collection point."
			),
	});
	let passed = $state(false);
	let checkedSelection = $state("");
	const form = superForm(
		{ collection: "" },
		{
			id: prefix,
			SPA: true,
			validators: zodClient(schema),
			resetForm: false,
			validationMethod: "submit-only",
			autoFocusOnError: false,
			scrollToError: "off",
			onUpdate({ form }) {
				passed = form.valid;
				checkedSelection = form.data.collection;
			},
		}
	);
	const { form: formData, enhance, submitting } = form;
	let disabled = $state(false);
	let hydrated = $state(false);
	let open = $state(false);
	let trigger = $state<HTMLButtonElement | null>(null);
	const widgetDisabled = $derived(!hydrated || disabled || $submitting);
	onMount(() => {
		hydrated = true;
	});
	function resetSelection() {
		open = false;
		form.reset();
		passed = false;
	}
</script>

<div class={demoBoxClass}>
	<p class={hintClass}>
		Client-only simulation with Bits UI 1.8.0. Superforms validates browser state; nothing is
		sent or saved. The select requires JavaScript and is disabled until hydration.
	</p>
	<p class={hintClass}>
		Focus the select, press Enter or an arrow key, then use arrows and Enter to choose. Type
		“East” for typeahead; Escape closes the popup. Closed depot is unavailable.
	</p>
	<form method="POST" use:enhance novalidate class="flex flex-col gap-4">
		<div class={fieldClass}>
			<Field {form} name="collection">
				<Control id={`${prefix}-collection`}>
					<CollectionSelect
						bind:value={$formData.collection}
						bind:open
						bind:ref={trigger}
						disabled={widgetDisabled}
					/>
				</Control>
				{#snippet description()}<p class={hintClass}>
						Choose an open depot for collection.
					</p>{/snippet}
				{#snippet fieldErrors({ errors, errorProps })}{#each errors as error (error)}<p
							{...errorProps}
							class={errorClass}
						>
							{error}
						</p>{/each}{/snippet}
			</Field>
		</div>
		<div class="flex items-center gap-2">
			<input
				id={`${prefix}-disabled`}
				type="checkbox"
				bind:checked={disabled}
				disabled={!hydrated || $submitting}
				onchange={() => {
					open = false;
				}}
			/>
			<label for={`${prefix}-disabled`} class={labelClass}
				>Disable the widget and hidden transport</label
			>
		</div>
		<p class={hintClass}>
			Disabling retains the selection. The hidden input is excluded from native FormData while
			disabled; this SPA demo still validates Superforms’ in-memory value, not a native
			request.
		</p>
		<div class="flex flex-wrap gap-2">
			<button type="submit" class={submitClass} disabled={!hydrated || $submitting}
				>{$submitting ? "Checking…" : "Check selection"}</button
			>
			<button
				type="button"
				class={secondaryButtonClass}
				disabled={widgetDisabled}
				onclick={() => trigger?.focus()}>Focus collection point</button
			>
			<button
				type="button"
				class={secondaryButtonClass}
				disabled={!hydrated || $submitting}
				onclick={resetSelection}>Reset selection</button
			>
		</div>
		{#if passed && checkedSelection === $formData.collection}<p class={hintClass}>
				Validation passed. Nothing was sent or saved.
			</p>{/if}
	</form>
</div>
