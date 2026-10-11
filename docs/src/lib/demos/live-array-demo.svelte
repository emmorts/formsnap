<script lang="ts">
	import { onMount, tick } from "svelte";
	import { Control, ElementField, Fieldset, Label, Legend } from "@emmorts/formsnap";
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
	const schema = z.object({
		invites: z
			.array(z.string().email("Enter a valid email address."))
			.min(1, "Keep at least one invite.")
			.max(3, "Three invites at a time."),
	});
	let passed = $state(false);
	let hydrated = $state(false);
	let addButton = $state<HTMLButtonElement>();
	let mutationMessage = $state("");
	let mutationCount = 0;
	const form = superForm(
		{ invites: ["", ""] },
		{
			id: prefix,
			SPA: true,
			validators: zodClient(schema),
			resetForm: false,
			validationMethod: "submit-only",
			onUpdate({ form }) {
				passed = form.valid;
			},
		}
	);
	const { form: formData, errors, tainted, enhance, submitting } = form;
	let nextId = 2;
	let rowIds = $state([0, 1]);
	onMount(() => {
		hydrated = true;
	});

	// Application-owned identity moves values, submitted errors and taint together.
	// Never key a row by its index, value, or Superforms-owned row object.
	function replaceRows(nextIds: number[]) {
		const previousIndexes: Partial<Record<number, number>> = {};
		rowIds.forEach((id, index) => {
			previousIndexes[id] = index;
		});
		const nextInvites = nextIds.map((id) => {
			const index = previousIndexes[id];
			return index === undefined ? "" : $formData.invites[index]!;
		});
		const nextErrors: NonNullable<typeof $errors.invites> = {};
		const nextTaint: NonNullable<typeof $tainted> = { invites: {} };
		nextIds.forEach((id, index) => {
			const previousIndex = previousIndexes[id];
			if (previousIndex !== undefined && $errors.invites?.[previousIndex]) {
				nextErrors[index] = $errors.invites[previousIndex];
			}
			const rowTaint =
				previousIndex === undefined ? true : $tainted?.invites?.[previousIndex];
			if (rowTaint !== undefined) nextTaint.invites![index] = rowTaint;
		});
		rowIds = nextIds;
		formData.update((data) => ({ ...data, invites: nextInvites }), { taint: false });
		tainted.set(nextTaint);
		// Force replacement discards removed numeric slots and stale collection errors.
		errors.set({ ...$errors, invites: nextErrors }, { force: true });
		passed = false;
	}

	function announce(change: string) {
		mutationMessage = `Update ${++mutationCount}: ${change} ${rowIds.length} ${rowIds.length === 1 ? "invite" : "invites"} remaining.`;
	}

	async function focusRow(id: number | undefined) {
		await tick();
		if (id === undefined) addButton?.focus();
		else document.getElementById(`${prefix}-invite-${id}`)?.focus();
	}

	async function addRow() {
		const id = nextId++;
		replaceRows([...rowIds, id]);
		announce(`Added invite ${rowIds.length}.`);
		await focusRow(id);
	}

	async function reorderRows() {
		const active = document.activeElement;
		replaceRows([...rowIds].reverse());
		announce("Reversed the row order.");
		await tick();
		if (active instanceof HTMLElement && active.isConnected) active.focus();
	}

	async function removeRow(id: number) {
		const index = rowIds.indexOf(id);
		if (index < 0) return;
		const recoverFocus = document
			.getElementById(`${prefix}-row-${id}`)
			?.contains(document.activeElement);
		replaceRows(rowIds.filter((rowId) => rowId !== id));
		announce(`Removed invite ${index + 1}.`);
		if (recoverFocus) await focusRow(rowIds[index] ?? rowIds[index - 1]);
	}

	async function resetRows() {
		form.reset();
		rowIds = [nextId++, nextId++];
		passed = false;
		announce("Reset the invites.");
		await focusRow(rowIds[0]);
	}
</script>

<div class={demoBoxClass}>
	<p class={hintClass}>
		Client-only simulation: Superforms validates in this browser. Nothing is sent or saved; this
		demo does not make a native POST.
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
		<Fieldset {form} name="invites">
			<Legend class="text-fg mb-3 text-sm font-medium">Invites</Legend>
			<div class="flex flex-col gap-4">
				{#each $formData.invites as _, index (rowIds[index])}
					<div id={`${prefix}-row-${rowIds[index]}`} class={fieldClass}>
						<ElementField {form} name={`invites[${index}]` as `invites[${number}]`}>
							{#snippet children({ tainted })}
								<Control id={`${prefix}-invite-${rowIds[index]}`}>
									{#snippet children({ props })}
										<Label class={labelClass}>Invite {index + 1}</Label>
										<input
											{...props}
											type="email"
											placeholder="ada@example.com"
											class={inputClass}
											bind:value={$formData.invites[index]}
										/>
									{/snippet}
								</Control>
								<p class={hintClass}>{tainted ? "Edited row" : "Unedited row"}</p>
							{/snippet}
							{#snippet fieldErrors({ errors, errorProps })}
								{#each errors as error (error)}<p
										{...errorProps}
										class={errorClass}
									>
										{error}
									</p>{/each}
							{/snippet}
						</ElementField>
						<button
							type="button"
							class={`${secondaryButtonClass} self-start`}
							disabled={!hydrated || $submitting}
							aria-label={`Remove invite ${index + 1}`}
							onclick={() => removeRow(rowIds[index]!)}>Remove</button
						>
					</div>
				{/each}
			</div>
			{#snippet fieldErrors({ errors, errorProps })}
				{#each errors as error (error)}<p {...errorProps} class={`${errorClass} mt-2`}>
						{error}
					</p>{/each}
			{/snippet}
		</Fieldset>
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				bind:this={addButton}
				class={secondaryButtonClass}
				disabled={!hydrated || $submitting || rowIds.length >= 3}
				onclick={addRow}>Add invite</button
			>
			<button
				type="button"
				class={secondaryButtonClass}
				disabled={!hydrated || $submitting || rowIds.length < 2}
				onclick={reorderRows}>Reverse rows</button
			>
			<button type="submit" disabled={!hydrated || $submitting} class={submitClass}
				>{$submitting ? "Checking…" : "Check invites"}</button
			>
			<button
				type="button"
				class={secondaryButtonClass}
				disabled={!hydrated || $submitting}
				onclick={resetRows}>Reset</button
			>
		</div>
		<div aria-live="polite" aria-atomic="true" class={hintClass}>{mutationMessage}</div>
		{#if passed}<p class={hintClass}>Validation passed. Nothing was sent or saved.</p>{/if}
	</form>
</div>
