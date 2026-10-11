<script lang="ts">
	import { onMount, tick } from "svelte";
	import { Control, Field, Label } from "@emmorts/formsnap";
	import { superForm } from "sveltekit-superforms";
	import { zodClient } from "sveltekit-superforms/adapters";
	import { z } from "zod/v3";
	import {
		demoBoxClass,
		errorClass,
		fieldClass,
		hintClass,
		inputClass,
		labelClass,
		secondaryButtonClass,
		submitClass,
	} from "./input-classes";

	const prefix = $props.id();
	// Validate calendar components, rather than accepting Date.parse's normalized dates.
	function calendarDate(value: string) {
		const match = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(value);
		if (!match || match[0] !== value) return undefined;
		const year = Number(match[1]);
		const month = Number(match[2]);
		const day = Number(match[3]);
		if (!Number.isSafeInteger(year) || year < 1 || month < 1 || month > 12) return undefined;
		const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
		const daysInMonth =
			month === 2 ? (leapYear ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
		if (day < 1 || day > daysInMonth) return undefined;
		return { year, month, day };
	}
	const schema = z
		.object({
			start: z.string().min(1, "Choose a start date."),
			end: z.string().min(1, "Choose an end date."),
			contactNeeded: z.boolean(),
			phone: z.string(),
		})
		.superRefine((booking, context) => {
			const start = calendarDate(booking.start);
			const end = calendarDate(booking.end);
			if (booking.start && !start)
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["start"],
					message: "Choose a valid start date.",
				});
			if (booking.end && !end)
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["end"],
					message: "Choose a valid end date.",
				});
			if (
				start &&
				end &&
				(end.year < start.year ||
					(end.year === start.year &&
						(end.month < start.month ||
							(end.month === start.month && end.day <= start.day))))
			) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					message: "The end date must be after the start date.",
				});
			}
			if (booking.contactNeeded && !booking.phone.trim())
				context.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["phone"],
					message: "Enter a contact phone number.",
				});
		});
	let attempt = $state(0);
	let passed = $state(false);
	const form = superForm(
		{ start: "2026-10-11", end: "2026-10-11", contactNeeded: true, phone: "" },
		{
			id: prefix,
			SPA: true,
			validators: zodClient(schema),
			resetForm: false,
			validationMethod: "submit-only",
			clearOnSubmit: "errors",
			autoFocusOnError: false,
			scrollToError: "off",
			onUpdate({ form }) {
				attempt += 1;
				passed = form.valid;
			},
		}
	);
	const { form: formData, errors, allErrors, enhance, submitting } = form;
	let hydrated = $state(false);
	let startInput = $state<HTMLInputElement>();
	let endInput = $state<HTMLInputElement>();
	let phoneInput = $state<HTMLInputElement>();
	let contactOpen = $state(false);
	onMount(() => {
		hydrated = true;
	});
	const labels: Record<string, string> = {
		start: "Start date",
		end: "End date",
		phone: "Contact phone",
	};
	const targets = $derived({
		start: { id: `${prefix}-start`, element: startInput },
		end: { id: `${prefix}-end`, element: endInput },
		phone: $formData.contactNeeded ? { id: `${prefix}-phone`, element: phoneInput } : undefined,
	});
	function targetFor(path: string) {
		if (path === "start" || path === "end" || path === "phone") return targets[path];
		return undefined;
	}
	async function focusTarget(event: MouseEvent, path: string) {
		event.preventDefault();
		if (!targetFor(path)) return;
		if (path === "phone") contactOpen = true;
		await tick();
		// Re-read after revealing the section; an unmounted field never receives focus.
		targetFor(path)?.element?.focus();
	}
</script>

<div class={demoBoxClass}>
	<p class={hintClass}>
		Client-only simulation: nothing is sent or saved. Check the initial booking for a root error
		and a phone error. Its phone link opens Contact details before focusing the input.
	</p>
	<form
		method="POST"
		use:enhance
		novalidate
		class="flex flex-col gap-4"
		oninput={() => {
			passed = false;
		}}
	>
		<!-- Exactly one persistent polite region owns all rejection announcements. -->
		<div aria-live="polite" aria-atomic="true">
			{#if $allErrors.length}
				<section
					aria-labelledby={`${prefix}-summary-title`}
					class="border-line rounded-lg border p-3"
				>
					<h3 id={`${prefix}-summary-title`} class={labelClass}>
						Check this booking — attempt {attempt}
					</h3>
					<ul class="mt-2 flex flex-col gap-2 text-sm">
						{#each $allErrors as error (error.path)}
							{@const target = targetFor(error.path)}
							{#each error.messages as errorMessage, index (index)}
								<li>
									{#if target}
										<a
											class="text-accent underline underline-offset-2"
											href={`#${target.id}`}
											onclick={(event) => focusTarget(event, error.path)}
											>{labels[error.path]}: {errorMessage}</a
										>
									{:else}
										<span class={errorClass}
											>{labels[error.path] ?? "Booking"}: {errorMessage}</span
										>
									{/if}
								</li>
							{/each}
						{/each}
					</ul>
				</section>
			{:else if passed}
				<p class={hintClass}>Validation passed. Nothing was sent or saved.</p>
			{/if}
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class={fieldClass}>
				<Field {form} name="start" fieldErrorsLive="off">
					<Control id={`${prefix}-start`}>
						{#snippet children({ props })}
							<Label class={labelClass}>Start date</Label>
							<input
								{...props}
								type="date"
								class={inputClass}
								bind:value={$formData.start}
								bind:this={startInput}
							/>
						{/snippet}
					</Control>
					{#snippet fieldErrors({ errors, errorProps })}{#each errors as error (error)}<p
								{...errorProps}
								class={errorClass}
							>
								{error}
							</p>{/each}{/snippet}
				</Field>
			</div>
			<div class={fieldClass}>
				<Field {form} name="end" fieldErrorsLive="off">
					<Control id={`${prefix}-end`}>
						{#snippet children({ props })}
							<Label class={labelClass}>End date</Label>
							<input
								{...props}
								type="date"
								class={inputClass}
								bind:value={$formData.end}
								bind:this={endInput}
							/>
						{/snippet}
					</Control>
					{#snippet fieldErrors({ errors, errorProps })}{#each errors as error (error)}<p
								{...errorProps}
								class={errorClass}
							>
								{error}
							</p>{/each}{/snippet}
				</Field>
			</div>
		</div>
		<Field {form} name="contactNeeded">
			<Control id={`${prefix}-contact-needed`}>
				{#snippet children({ props })}
					<div class="flex items-center gap-2">
						<input {...props} type="checkbox" bind:checked={$formData.contactNeeded} />
						<Label class={labelClass}>Include contact details</Label>
					</div>
				{/snippet}
			</Control>
		</Field>
		{#if $formData.contactNeeded}
			<details bind:open={contactOpen} class="border-line rounded-lg border p-3">
				<summary class={`${labelClass} cursor-pointer`}>Contact details</summary>
				<div class={`${fieldClass} mt-3`}>
					<Field {form} name="phone" fieldErrorsLive="off">
						<Control id={`${prefix}-phone`}>
							{#snippet children({ props })}
								<Label class={labelClass}>Contact phone</Label>
								<input
									{...props}
									type="tel"
									class={inputClass}
									bind:value={$formData.phone}
									bind:this={phoneInput}
								/>
							{/snippet}
						</Control>
						{#snippet fieldErrors({
							errors,
							errorProps,
						})}{#each errors as error (error)}<p {...errorProps} class={errorClass}>
									{error}
								</p>{/each}{/snippet}
					</Field>
				</div>
			</details>
		{/if}
		<p class={hintClass}>
			After rejection, uncheck Include contact details: its error stays readable, but its link
			disappears. Check twice without edits to repeat the same rejection.
		</p>
		<div class="flex flex-wrap gap-2">
			<button type="submit" class={submitClass} disabled={!hydrated || $submitting}
				>{$submitting ? "Checking…" : "Check booking"}</button
			>
			<button
				type="button"
				class={secondaryButtonClass}
				disabled={!hydrated || $submitting}
				onclick={() => {
					errors.set({}, { force: true });
					passed = false;
				}}>Clear errors</button
			>
			<button
				type="button"
				class={secondaryButtonClass}
				disabled={!hydrated || $submitting}
				onclick={() => {
					form.reset();
					contactOpen = false;
					passed = false;
				}}>Reset</button
			>
		</div>
	</form>
</div>
