<script lang="ts">
	import { onMount, tick, untrack } from "svelte";
	import { Control, Field, Label } from "@emmorts/formsnap";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { zodClient } from "sveltekit-superforms/adapters";
	import { initialRequest, multiStepSchema, type MultiStepData } from "./schema.js";

	let {
		validated,
		clientOnly = false,
		restartHref,
		styles = {},
	}: {
		validated?: SuperValidated<MultiStepData>;
		clientOnly?: boolean;
		restartHref: string;
		styles?: Partial<
			Record<
				"form" | "field" | "input" | "label" | "hint" | "error" | "button" | "secondary",
				string
			>
		>;
	} = $props();

	// One owner survives every step. SPA is used only by the explicitly client-only docs demo.
	const local = untrack(() => clientOnly);
	let step = $state(0);
	let hydrated = $state(false);
	let companyOpen = $state(true);
	let completed = $state(false);
	let advancing = $state(false);
	const instanceId = $props.id();
	const prefix = `multi-step-${instanceId}`;
	let companyRevealed = $state(false);
	const form = superForm<MultiStepData>(
		untrack(() => validated ?? { ...initialRequest }),
		{
			id: local ? prefix : "multi-step",
			SPA: local ? true : undefined,
			validators: zodClient(multiStepSchema),
			resetForm: false,
			invalidateAll: false,
			validationMethod: "submit-only",
			autoFocusOnError: false,
			scrollToError: "off",
			onSubmit: async ({ cancel }) => {
				// Enter on an earlier step advances; it never sends a partial final request.
				if (hydrated && step < 2) {
					cancel();
					await next();
				}
			},
			onUpdated({ form: result }) {
				completed = result.valid && (local || Boolean(result.message));
			},
		}
	);
	const { form: formData, errors, allErrors, enhance, message, submitting } = form;
	onMount(() => {
		hydrated = true;
	});

	const fields = {
		name: { label: "Full name", step: 0 },
		email: { label: "Email", step: 0 },
		kind: { label: "Request type", step: 1 },
		company: { label: "Company name", step: 1 },
		notes: { label: "Request details", step: 1 },
	} as const;
	type FieldName = keyof typeof fields;
	function knownField(path: string): path is FieldName {
		return Object.prototype.hasOwnProperty.call(fields, path);
	}

	async function goTo(nextStep: number) {
		step = nextStep;
		await tick();
		document.getElementById(`${prefix}-step-${step}`)?.focus();
	}

	async function next() {
		if (advancing || step >= 2) return;
		advancing = true;
		try {
			// Superforms validates the shared final schema. Only the current step's errors
			// block Next; future required fields are not announced before they are visited.
			const result = await form.validateForm({ update: false, focusOnError: false });
			const currentErrors = Object.fromEntries(
				Object.entries(result.errors).filter(
					([path]) => knownField(path) && fields[path].step === step
				)
			);
			errors.set(currentErrors, { force: true });
			if (Object.keys(currentErrors).length === 0) await goTo(step + 1);
		} finally {
			advancing = false;
		}
	}

	async function focusError(event: MouseEvent, path: FieldName) {
		event.preventDefault();
		step = fields[path].step;
		if (path === "company") {
			companyOpen = true;
			companyRevealed = true;
		}
		await tick();
		document.getElementById(`${prefix}-${path}`)?.focus();
	}

	async function startAgain() {
		form.reset();
		completed = false;
		companyOpen = true;
		companyRevealed = false;
		await goTo(0);
	}
</script>

<form
	method="POST"
	use:enhance
	novalidate
	class={styles.form}
	data-testid="recipe-multi-step"
	data-hydrated={hydrated}
>
	{#if local}
		<p class={styles.hint}>
			Browser-only demonstration: nothing is sent or saved. Final validation here is not a
			server result.
		</p>
		<noscript
			><p>
				This static demonstration requires JavaScript. Use the complete SvelteKit recipe for
				the native POST fallback.
			</p></noscript
		>
	{:else}
		<p class={styles.hint}>
			The final POST is validated by the server. This example does not save requests.
		</p>
		<noscript
			><p>
				Without JavaScript, all fields are shown. Complete them and submit once for full
				server validation. Company name is ignored for personal requests.
			</p></noscript
		>
	{/if}

	{#if hydrated}
		<p class={styles.hint} aria-live="polite">
			Step {step + 1} of 3: {["Contact", "Details", "Review"][step]}
		</p>
	{/if}
	<div aria-live="polite" aria-atomic="true">
		{#if $allErrors.length}
			<section aria-labelledby={`${prefix}-errors-title`} data-testid="multi-step-errors">
				<h2 id={`${prefix}-errors-title`}>Check your request</h2>
				<ul>
					{#each $allErrors as error (error.path)}
						{#each error.messages as errorMessage, index (index)}
							<li class={styles.error}>
								{#if knownField(error.path)}
									<a
										href={`#${prefix}-${error.path}`}
										onclick={(event) =>
											focusError(event, error.path as FieldName)}
										>{fields[error.path].label}: {errorMessage}</a
									>
								{:else}
									Request: {errorMessage}
								{/if}
							</li>
						{/each}
					{/each}
				</ul>
			</section>
		{/if}
	</div>

	<!-- hidden is presentation only: mounted, named, enabled inputs still serialize in a
	     native FormData POST. Do not replace these sections with unmounting #if blocks. -->
	<section hidden={hydrated && step !== 0} aria-labelledby={`${prefix}-step-0`}>
		<h2 id={`${prefix}-step-0`} tabindex="-1">Contact</h2>
		<div class={styles.field}>
			<Field {form} name="name" fieldErrors fieldErrorsLive="off">
				<Control id={`${prefix}-name`}>
					{#snippet children({ props })}
						<Label class={styles.label}>Full name</Label>
						<input
							{...props}
							class={styles.input}
							autocomplete="name"
							bind:value={$formData.name}
						/>
					{/snippet}
				</Control>
			</Field>
		</div>
		<div class={styles.field}>
			<Field {form} name="email" fieldErrors fieldErrorsLive="off">
				<Control id={`${prefix}-email`}>
					{#snippet children({ props })}
						<Label class={styles.label}>Email</Label>
						<input
							{...props}
							class={styles.input}
							type="email"
							autocomplete="email"
							bind:value={$formData.email}
						/>
					{/snippet}
				</Control>
			</Field>
		</div>
	</section>

	<section hidden={hydrated && step !== 1} aria-labelledby={`${prefix}-step-1`}>
		<h2 id={`${prefix}-step-1`} tabindex="-1">Details</h2>
		<div class={styles.field}>
			<Field {form} name="kind" fieldErrors fieldErrorsLive="off">
				<Control id={`${prefix}-kind`}>
					{#snippet children({ props })}
						<Label class={styles.label}>Request type</Label>
						<select {...props} class={styles.input} bind:value={$formData.kind}>
							<option value="personal">Personal</option>
							<option value="business">Business</option>
						</select>
					{/snippet}
				</Control>
			</Field>
		</div>
		<div hidden={hydrated && $formData.kind !== "business" && !companyRevealed}>
			<details bind:open={companyOpen}>
				<summary>Business details</summary>
				<div class={styles.field}>
					<Field {form} name="company" fieldErrors fieldErrorsLive="off">
						<Control id={`${prefix}-company`}>
							{#snippet children({ props })}
								<Label class={styles.label}>Company name</Label>
								<input
									{...props}
									class={styles.input}
									autocomplete="organization"
									bind:value={$formData.company}
								/>
							{/snippet}
						</Control>
					</Field>
				</div>
			</details>
		</div>
		<p class={styles.hint}>
			Changing to Personal retains the company value while editing. It is not required or used
			for a personal request; the server clears it on acceptance.
		</p>
		<div class={styles.field}>
			<Field {form} name="notes" fieldErrors fieldErrorsLive="off">
				<Control id={`${prefix}-notes`}>
					{#snippet children({ props })}
						<Label class={styles.label}>Request details</Label>
						<textarea
							{...props}
							class={styles.input}
							rows="3"
							bind:value={$formData.notes}></textarea>
					{/snippet}
				</Control>
			</Field>
		</div>
	</section>

	<section hidden={hydrated && step !== 2} aria-labelledby={`${prefix}-step-2`}>
		<h2 id={`${prefix}-step-2`} tabindex="-1">Review</h2>
		<dl>
			<dt>Contact</dt>
			<dd>{$formData.name} — {$formData.email}</dd>
			<dt>Request type</dt>
			<dd>{$formData.kind}</dd>
			{#if $formData.kind === "business"}<dt>Company</dt>
				<dd>{$formData.company}</dd>{/if}
			<dt>Request details</dt>
			<dd>{$formData.notes}</dd>
		</dl>
		<p class={styles.hint}>
			Reviewing or passing a client step does not mean the server accepted this request.
		</p>
	</section>

	<div>
		{#if hydrated && step > 0}
			<button
				type="button"
				class={styles.secondary}
				disabled={$submitting || advancing || completed}
				onclick={() => goTo(step - 1)}>Back</button
			>
		{/if}
		{#if hydrated && step < 2}
			<button type="submit" class={styles.button} disabled={$submitting || advancing}
				>Next</button
			>
		{:else}
			<button
				type="submit"
				class={styles.button}
				disabled={(local && !hydrated) || $submitting || completed}
				>{local ? "Validate final request" : "Submit request"}</button
			>
		{/if}
	</div>
	{#if $message || completed}
		<p role="status" data-testid="multi-step-success">
			{local ? "Client validation passed. Nothing was sent or saved." : $message}
		</p>
		{#if hydrated}
			<button
				type="button"
				class={styles.secondary}
				disabled={$submitting}
				onclick={startAgain}>Start again</button
			>
		{:else}
			<!-- The route owner resolves this URL; resolving it again would duplicate the base path. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={restartHref}>Start again</a>
		{/if}
	{/if}
</form>
