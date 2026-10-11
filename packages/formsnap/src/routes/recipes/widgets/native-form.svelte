<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, Field, Fieldset, Label, Legend } from "$lib/index.js";
	import { channelOptions, deliveryOptions, type NativeData } from "./schema.js";

	let { validated }: { validated: SuperValidated<NativeData> } = $props();
	const form = superForm(
		untrack(() => validated),
		{
			id: "widgets-native",
			resetForm: false,
			invalidateAll: false,
			validationMethod: "submit-only",
		}
	);
	const { form: formData, enhance, message, reset } = form;
	let disabled = $state(false);
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<section aria-labelledby="widgets-native-heading">
	<h2 id="widgets-native-heading">Native radios and multiple select</h2>
	<p>
		Both controls submit without JavaScript. Each radio has its own label and ID inside a
		fieldset named by its legend. The multiple select submits repeated channel values. This
		example uses novalidate to show server errors; the schema always enforces the required
		selection and the limit of two channels, which HTML cannot express on a multiple select.
	</p>
	<label for="widgets-native-disabled">Disable native controls</label>
	<input
		id="widgets-native-disabled"
		type="checkbox"
		bind:checked={disabled}
		disabled={!hydrated}
	/>

	<form
		method="POST"
		action="?/native"
		use:enhance
		novalidate
		onreset={() => reset()}
		data-testid="recipe-widgets-native"
		data-hydrated={hydrated}
	>
		<Fieldset {form} name="delivery" {disabled} fieldErrors>
			<Legend>Delivery speed</Legend>
			{#each deliveryOptions as option (option.value)}
				<Control id={`widgets-delivery-${option.value}`}>
					{#snippet children({ props })}
						<input
							{...props}
							type="radio"
							value={option.value}
							required
							bind:group={$formData.delivery}
						/>
						<Label>{option.label}</Label>
					{/snippet}
				</Control>
			{/each}
			{#snippet description()}Choose standard or express delivery.{/snippet}
		</Fieldset>

		<Field {form} name="channels" fieldErrors>
			<Control id="widgets-channels">
				{#snippet children({ props })}
					<Label>Notification channels</Label>
					<select
						{...props}
						multiple
						required
						{disabled}
						size={3}
						bind:value={$formData.channels}
					>
						{#each channelOptions as option (option.value)}
							<!-- Keep selected options in native server HTML across the supported Svelte range. -->
							<option
								value={option.value}
								selected={$formData.channels.includes(option.value)}
							>
								{option.label}
							</option>
						{/each}
					</select>
				{/snippet}
			</Control>
			{#snippet description()}Choose one or two notification channels.{/snippet}
		</Field>
		<button type="submit">Save native preferences</button>
		<button type="reset">Reset native preferences</button>
	</form>
	{#if $message}<output data-testid="widgets-native-message">{$message}</output>{/if}
</section>
