<script lang="ts">
	import { untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, Description, Field, FieldErrors, Label } from "$lib/index.js";
	import type { SettingsData } from "../../src/routes/schema.js";

	let { validated }: { validated: SuperValidated<SettingsData> } = $props();
	const form = superForm(untrack(() => validated));
	let descriptionId = $state("moving-help");
	let errorsId = $state("moving-errors");
	let descriptionRef = $state<HTMLElement | null>(null);
	let errorsRef = $state<HTMLElement | null>(null);
	let omittedDescriptionRef = $state<HTMLElement | null>(null);
	let omittedErrorsRef = $state<HTMLElement | null>(null);
	let showCustomDescription = $state(true);
	let showCustomErrors = $state(true);
	let showDefaultErrors = $state(true);
	let showDefaultDescription = $state(true);

	export function references() {
		return { description: descriptionRef, errors: errorsRef };
	}
</script>

<!-- These belong to another consumer, not to the custom children below. -->
<p id="unspread-help">Unrelated help</p>
<div id="unspread-errors">Unrelated errors</div>

<Field {form} name="email">
	<Control>
		{#snippet children({ props })}
			<Label>Email</Label>
			<input {...props} />
		{/snippet}
	</Control>
	{#if showDefaultDescription}
		<Description id={descriptionId} bind:ref={descriptionRef}>Moving help</Description>
	{/if}
	<Description id="custom-help">
		{#snippet child({ props })}
			{#if showCustomDescription}
				<p {...props}>Conditional custom help</p>
			{/if}
		{/snippet}
	</Description>
	<FieldErrors id={errorsId} bind:ref={errorsRef}>
		{#snippet child({ props, errors, errorProps })}
			{#if showCustomErrors}
				<section {...props}>
					{#each errors as error, index (index)}
						<p {...errorProps}>{error}</p>
					{/each}
				</section>
			{/if}
		{/snippet}
	</FieldErrors>
	{#if showDefaultErrors}
		<FieldErrors id="remaining-errors" />
	{/if}
	<Description id="unspread-help" bind:ref={omittedDescriptionRef}>
		{#snippet child()}
			<p>Forgotten description spread</p>
		{/snippet}
	</Description>
	<FieldErrors id="unspread-errors" bind:ref={omittedErrorsRef}>
		{#snippet child()}
			<div>Forgotten errors spread</div>
		{/snippet}
	</FieldErrors>
</Field>

<output
	data-rendered-refs
	data-description-ref={descriptionRef ? "bound" : "none"}
	data-errors-ref={errorsRef ? "bound" : "none"}
	data-omitted-description-ref={omittedDescriptionRef?.id ?? "none"}
	data-omitted-errors-ref={omittedErrorsRef?.id ?? "none"}
></output>

<button type="button" onclick={() => (descriptionId = "renamed-help")}>rename help</button>
<button type="button" onclick={() => (errorsId = "renamed-errors")}>rename errors</button>
<button type="button" onclick={() => (showCustomDescription = !showCustomDescription)}>
	toggle custom description child
</button>
<button type="button" onclick={() => (showCustomErrors = !showCustomErrors)}>
	toggle custom errors child
</button>
<button type="button" onclick={() => (showDefaultErrors = !showDefaultErrors)}>
	toggle default errors
</button>
<button type="button" onclick={() => (showDefaultDescription = !showDefaultDescription)}>
	toggle default description
</button>
