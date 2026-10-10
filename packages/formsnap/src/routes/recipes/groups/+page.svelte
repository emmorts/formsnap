<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, Fieldset, Label, Legend, type FieldsetAttrs } from "$lib/index.js";
	import AgreementControl from "./agreement-control.svelte";
	import type { GroupsData } from "./schema.js";

	let { data }: { data: { form: SuperValidated<GroupsData> } } = $props();

	const form = superForm(
		untrack(() => data.form),
		{ resetForm: false }
	);
	const { form: formData, enhance, message } = form;

	let groupsDisabled = $state(false);
	let customControl = $state<HTMLButtonElement | null>(null);
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<h1>Native and custom groups</h1>
<p>
	The native checkbox works without JavaScript. The custom checkbox needs JavaScript; without it,
	its hidden input submits the initial false value. A custom group must provide its own heading,
	description and errors with matching IDs, and disable its interactive control and hidden input.
	An aria-disabled container alone does not disable its children.
</p>

<label for="groups-disabled">Disable groups</label>
<input id="groups-disabled" type="checkbox" bind:checked={groupsDisabled} />
<button type="button" onclick={() => customControl?.focus()}>Focus custom control</button>

<form method="POST" use:enhance data-testid="recipe-groups" data-hydrated={hydrated}>
	<Fieldset
		{form}
		name="nativeAccepted"
		disabled={groupsDisabled}
		data-testid="native-group"
		fieldErrors
	>
		<Legend>Native agreement</Legend>
		<Control>
			{#snippet children({ props })}
				<input type="checkbox" {...props} bind:checked={$formData.nativeAccepted} />
				<Label>Accept native terms</Label>
			{/snippet}
		</Control>
		{#snippet description()}Accept the native terms before saving.{/snippet}
	</Fieldset>

	<!-- A child replaces the fieldset, so the caller owns every group region and association. -->
	<Fieldset {form} name="customAccepted" id="custom-agreement" disabled={groupsDisabled}>
		{#snippet child({ props, errors }: { props: FieldsetAttrs; errors: string[] })}
			<div
				{...props}
				data-testid="custom-group"
				role="group"
				aria-labelledby={`${props.id}-heading`}
				aria-describedby={`${props.id}-description${errors.length ? ` ${props.id}-errors` : ""}`}
				aria-disabled={props.disabled ? "true" : "false"}
			>
				<h2 id={`${props.id}-heading`}>Custom agreement</h2>
				<Control>
					<AgreementControl
						bind:value={$formData.customAccepted}
						bind:ref={customControl}
						disabled={!!props.disabled}
						describedBy={`${props.id}-description${errors.length ? ` ${props.id}-errors` : ""}`}
					/>
				</Control>
				<p
					id={`${props.id}-description`}
					data-testid="custom-description"
					data-fs-description=""
					data-fs-error={errors.length ? "" : undefined}
				>
					Accept the custom terms before saving.
				</p>
				<ul
					id={`${props.id}-errors`}
					data-testid="custom-errors"
					data-fs-field-errors=""
					data-fs-error={errors.length ? "" : undefined}
					aria-live="assertive"
				>
					{#each errors as error, index (index)}
						<li data-fs-field-error="" data-fs-error="">{error}</li>
					{/each}
				</ul>
			</div>
		{/snippet}
	</Fieldset>

	<button type="submit">Save agreements</button>
</form>

{#if $message}
	<output data-testid="groups-message">{$message}</output>
{/if}
