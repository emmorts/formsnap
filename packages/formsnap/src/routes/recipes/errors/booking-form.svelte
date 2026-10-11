<script lang="ts">
	import { onMount, tick, untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, Field, Label } from "$lib/index.js";
	import type { ErrorsData } from "./schema.js";

	let {
		validated,
		scope,
		title,
	}: {
		validated: SuperValidated<ErrorsData>;
		scope: "personal" | "work";
		title: string;
	} = $props();

	const prefix = untrack(() => `errors-${scope}`);
	const form = superForm(
		untrack(() => validated),
		{
			id: prefix,
			resetForm: false,
			// Clear through Superforms so identical rejections restore fresh summary content.
			clearOnSubmit: "errors",
			// The summary is the sole live announcement. Superforms does not also move focus to
			// a field on rejection; links move it only at the user's explicit request.
			autoFocusOnError: false,
			scrollToError: "off",
			validationMethod: "submit-only",
		}
	);
	const { form: formData, errors, allErrors, enhance, message } = form;
	let startInput = $state<HTMLInputElement>();
	let endInput = $state<HTMLInputElement>();
	let phoneInput = $state<HTMLInputElement>();
	let contactOpen = $state(true);
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});

	// Caller-owned IDs are supplied to Control and used directly in hrefs. A target is never
	// inferred from a Formsnap-generated ID or registered by a field's mount order.
	const labels: Record<string, string> = {
		start: "Start date",
		end: "End date",
		phone: "Contact phone",
		contactNeeded: "Contact requested",
	};
	const targets = $derived({
		start: { id: `${prefix}-start`, element: startInput },
		end: { id: `${prefix}-end`, element: endInput },
		phone: $formData.contactNeeded ? { id: `${prefix}-phone`, element: phoneInput } : undefined,
	});

	function targetFor(path: string) {
		if (path === "start" || path === "end" || path === "phone") return targets[path];
		// Root (_errors) and unmapped group errors stay readable, without a fabricated link.
		return undefined;
	}

	async function focusTarget(event: MouseEvent, path: string) {
		const target = targetFor(path);
		if (!target) return;
		event.preventDefault();
		if (path === "phone") contactOpen = true;
		await tick();
		// Re-read the mapping after the tick: removing a conditional section cannot leave a
		// stale reference to its former input. This is link activation, not an autofocus engine.
		targetFor(path)?.element?.focus();
	}
</script>

<form
	method="POST"
	action={`?/${scope}`}
	use:enhance
	novalidate
	data-testid={`recipe-errors-${scope}`}
	data-hydrated={hydrated}
>
	<h2>{title}</h2>
	<!-- Keep one live region mounted, including while empty. Inline errors remain associated
	     descriptions with live="off", so the same rejection is not announced twice. -->
	<div aria-live="polite" aria-atomic="true" data-testid={`${prefix}-announcement`}>
		{#if $allErrors.length}
			<section aria-labelledby={`${prefix}-summary-title`} data-testid={`${prefix}-summary`}>
				<h3 id={`${prefix}-summary-title`}>Check {title.toLowerCase()}</h3>
				<ul>
					{#each $allErrors as error (error.path)}
						{@const target = targetFor(error.path)}
						{#each error.messages as errorMessage, index (index)}
							<li>
								{#if target}
									<a
										href={`#${target.id}`}
										onclick={(event) => focusTarget(event, error.path)}
										>{labels[error.path]}: {errorMessage}</a
									>
								{:else}
									{labels[error.path] ?? "Booking"}: {errorMessage}
								{/if}
							</li>
						{/each}
					{/each}
				</ul>
			</section>
		{/if}
	</div>

	<!-- novalidate makes the real server schema responsible for rejected native POSTs too. -->
	<Field {form} name="start" fieldErrors fieldErrorsLive="off">
		<Control id={`${prefix}-start`}>
			{#snippet children({ props })}
				<Label>{labels.start}</Label>
				<input {...props} type="date" bind:value={$formData.start} bind:this={startInput} />
			{/snippet}
		</Control>
	</Field>
	<Field {form} name="end" fieldErrors fieldErrorsLive="off">
		<Control id={`${prefix}-end`}>
			{#snippet children({ props })}
				<Label>{labels.end}</Label>
				<input {...props} type="date" bind:value={$formData.end} bind:this={endInput} />
			{/snippet}
		</Control>
	</Field>
	<Field {form} name="contactNeeded" fieldErrors fieldErrorsLive="off">
		<Control id={`${prefix}-contact-needed`}>
			{#snippet children({ props })}
				<Label>{labels.contactNeeded}</Label>
				<input {...props} type="checkbox" bind:checked={$formData.contactNeeded} />
			{/snippet}
		</Control>
	</Field>
	{#if $formData.contactNeeded}
		<details bind:open={contactOpen}>
			<summary>Contact details</summary>
			<Field {form} name="phone" fieldErrors fieldErrorsLive="off">
				<Control id={`${prefix}-phone`}>
					{#snippet children({ props })}
						<Label>{labels.phone}</Label>
						<input
							{...props}
							type="tel"
							bind:value={$formData.phone}
							bind:this={phoneInput}
						/>
					{/snippet}
				</Control>
			</Field>
		</details>
	{/if}
	<button type="submit">Save {title.toLowerCase()}</button>
	<!-- Clearing uses Superforms' error store, without changing submitted values or focus. -->
	<button type="button" disabled={!hydrated} onclick={() => errors.set({}, { force: true })}
		>Clear errors</button
	>
	{#if $message}<p data-testid={`${prefix}-success`}>{$message}</p>{/if}
</form>
