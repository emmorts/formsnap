<script lang="ts">
	import { onMount, untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import {
		Control,
		Description,
		ElementField,
		Field,
		FieldErrors,
		Fieldset,
		Label,
		Legend,
	} from "$lib/index.js";
	import type { OwnedData } from "./schema.js";

	let {
		validated,
		localInitially = false,
	}: { validated: SuperValidated<OwnedData>; localInitially?: boolean } = $props();
	const form = superForm(
		untrack(() => validated),
		{ id: "owned-primary", resetForm: false }
	);
	const otherForm = superForm(
		untrack(() => validated),
		{ id: "owned-secondary" }
	);
	const { errors } = form;
	let hydrated = $state(false);
	let showDescription = $state(true);
	let showErrors = $state(true);
	let showParent = $state(true);
	let showLocal = $state(untrack(() => localInitially));
	let showAdditional = $state(false);
	let helpId = $state("owned-help");
	let errorId = $state("owned-errors");
	let parentId = $state("owned-parent-help");
	const executions: Record<string, number> = {};
	function execute(name: string) {
		const count = (executions[name] ?? 0) + 1;
		executions[name] = count;
		return count;
	}
	export function invocationCounts() {
		return { ...executions };
	}
	onMount(() => {
		hydrated = true;
	});
</script>

{#snippet emailHelp()}
	<span data-execution="description">{execute("description")}</span> Email help
{/snippet}
{#snippet emailErrors({
	errors: messages,
	errorProps,
}: {
	errors: string[];
	errorProps: Record<string, unknown>;
})}
	<span data-execution="errors">{execute("errors")}</span>
	{#each messages as message, index (index)}
		<p {...errorProps} data-custom-error>{message}</p>
	{/each}
{/snippet}
{#snippet parentHelp()}Shared URL help{/snippet}
{#snippet localHelp()}First URL help{/snippet}

<form data-testid="owned-primary" data-hydrated={hydrated}>
	<section data-scope="email">
		<Field
			{form}
			name="email"
			description={showDescription ? emailHelp : undefined}
			fieldErrors={showErrors ? emailErrors : false}
			descriptionId={helpId}
			fieldErrorsId={errorId}
		>
			<Control>
				{#snippet children({ props })}
					<Label>Owned email</Label><input {...props} />
				{/snippet}
			</Control>
			{#if showAdditional}<Description id="additional-help">Additional email help</Description
				>{/if}
		</Field>
	</section>
	<section data-scope="disabled">
		<Field
			{form}
			name="email"
			descriptionId="unused-help"
			fieldErrorsId="unused-errors"
			fieldErrors={false}
		>
			<Control
				>{#snippet children({ props })}<Label>Disabled regions</Label><input
						{...props}
					/>{/snippet}</Control
			>
		</Field>
	</section>
	<Fieldset
		{form}
		name="urls"
		data-testid="owned-group"
		description={showParent ? parentHelp : undefined}
		descriptionId={parentId}
		fieldErrors
		fieldErrorsId="owned-group-errors"
	>
		<Legend>Owned URLs</Legend>
		<section data-scope="local">
			<ElementField
				{form}
				name="urls[0]"
				description={showLocal ? localHelp : undefined}
				descriptionId="owned-local-help"
				fieldErrors
			>
				<Control
					>{#snippet children({ props })}<Label>First owned URL</Label><input
							{...props}
						/>{/snippet}</Control
				>
			</ElementField>
		</section>
		<section data-scope="inherited">
			<ElementField {form} name="urls[1]" fieldErrors>
				<Control
					>{#snippet children({ props })}<Label>Second owned URL</Label><input
							{...props}
						/>{/snippet}</Control
				>
			</ElementField>
		</section>
	</Fieldset>
	<section data-scope="explicit">
		<Field {form} name="bio">
			<Description id="caller-owned-help">Caller-owned before-control help</Description>
			<FieldErrors id="caller-owned-errors" />
			<Control
				>{#snippet children({ props })}<Label>Explicit association</Label><input
						{...props}
						aria-describedby="caller-owned-help"
					/>{/snippet}</Control
			>
		</Field>
	</section>
	<button type="button" onclick={() => (showDescription = !showDescription)}
		>Toggle owned description</button
	>
	<button type="button" onclick={() => (showErrors = !showErrors)}>Toggle owned errors</button>
	<button
		type="button"
		onclick={() => {
			helpId = "renamed-owned-help";
			errorId = "renamed-owned-errors";
			parentId = "renamed-parent-help";
		}}>Rename owned IDs</button
	>
	<button type="button" onclick={() => (showParent = !showParent)}
		>Toggle parent description</button
	>
	<button type="button" onclick={() => (showLocal = !showLocal)}>Toggle local description</button>
	<button type="button" onclick={() => (showAdditional = !showAdditional)}
		>Toggle additional description</button
	>
	<button type="button" onclick={() => ($errors = {})}>Clear errors</button>
	<button type="button" onclick={() => ($errors = untrack(() => validated.errors))}
		>Restore errors</button
	>
</form>
<form data-testid="owned-secondary">
	<Field form={otherForm} name="email" fieldErrors>
		<Control
			>{#snippet children({ props })}<Label>Other email</Label><input
					{...props}
				/>{/snippet}</Control
		>
		{#snippet description()}Other form help{/snippet}
	</Field>
	<Field form={otherForm} name="email" fieldErrors>
		<Control
			>{#snippet children({ props })}<Label>Other repeated email</Label><input
					{...props}
				/>{/snippet}</Control
		>
		{#snippet description()}Repeated field help{/snippet}
	</Field>
</form>
