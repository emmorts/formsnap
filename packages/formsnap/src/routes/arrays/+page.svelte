<script lang="ts">
	import { onMount, tick, untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, ElementField, Fieldset, Label, Legend } from "$lib/index.js";
	import type { UrlsData } from "./schema.js";

	let {
		data,
		form: action,
	}: {
		data: { form: SuperValidated<UrlsData> };
		form?: { form: SuperValidated<UrlsData> } | null;
	} = $props();

	const validated = untrack(() => action?.form ?? data.form);
	const form = superForm(
		untrack(() => data.form),
		{
			resetForm: false,
			invalidateAll: false,
			validationMethod: "submit-only",
		}
	);
	const { form: formData, errors, tainted, enhance, posted, message, submitting } = form;
	let rowIds = $state(validated.data.urls.map((_, index) => index));
	let nextRowId = validated.data.urls.length;

	let addButton = $state<HTMLButtonElement>();
	let mutationMessage = $state("");
	let mutationCount = 0;

	// Stable IDs belong to this application, not the schema or Formsnap. Superforms stores
	// validation by index, so move each row's errors and taint alongside its value.
	function replaceRows(nextIds: number[]) {
		const previousIndexes: Partial<Record<number, number>> = {};
		rowIds.forEach((id, index) => {
			previousIndexes[id] = index;
		});
		const nextUrls = nextIds.map((id) => {
			const index = previousIndexes[id];
			return index === undefined ? "https://added.example" : $formData.urls[index]!;
		});
		const nextErrors: NonNullable<typeof $errors.urls> = {};
		const nextTaint: NonNullable<typeof $tainted> = { urls: {} };
		nextIds.forEach((id, index) => {
			const previousIndex = previousIndexes[id];
			if (previousIndex !== undefined && $errors.urls?.[previousIndex]) {
				nextErrors[index] = $errors.urls[previousIndex];
			}
			const rowTaint = previousIndex === undefined ? true : $tainted?.urls?.[previousIndex];
			if (rowTaint !== undefined) nextTaint.urls![index] = rowTaint;
		});
		rowIds = nextIds;
		// Index comparison would mistake reordering for editing unrelated rows. Preserve the
		// mapped row taint instead; newly added rows are dirty. This is recipe policy.
		formData.update((data) => ({ ...data, urls: nextUrls }), { taint: false });
		tainted.set(nextTaint);
		// Retain errors for unchanged row values until the next real submission. Drop removed
		// slots and collection-level errors (_errors): membership/order has changed, so only
		// Superforms' next validation can determine whether a collection error still applies.
		errors.set({ ...$errors, urls: nextErrors }, { force: true });
	}

	function announce(change: string) {
		// The sequence makes consecutive identical operations a fresh text update in the same
		// polite region, without timers or a second assertive mutation announcement.
		mutationMessage = `Update ${++mutationCount}: ${change} ${rowIds.length} ${rowIds.length === 1 ? "row" : "rows"} remaining.`;
	}

	async function focusRow(id: number | undefined) {
		await tick();
		if (id === undefined) addButton?.focus();
		else document.getElementById(`array-url-${id}`)?.focus();
	}

	async function addRow() {
		const id = nextRowId++;
		replaceRows([...rowIds, id]);
		announce(`Added URL ${rowIds.length}.`);
		await focusRow(id);
	}

	async function reorderRows() {
		if (rowIds.length < 2) return;
		const active = document.activeElement;
		replaceRows([...rowIds].reverse());
		announce("Reversed the row order.");
		await tick();
		// A keyed DOM move can blur a native input. Restore only an existing active control;
		// reordering never chooses a different row as the new keyboard target.
		if (active instanceof HTMLElement && active.isConnected) active.focus();
	}

	async function removeRow(id = rowIds[rowIds.length - 1]) {
		if (id === undefined) return;
		const index = rowIds.indexOf(id);
		if (index < 0) return;
		const activeRow = document.getElementById(`array-row-${id}`);
		const recoverFocus = activeRow?.contains(document.activeElement);
		replaceRows(rowIds.filter((rowId) => rowId !== id));
		announce(`Removed URL ${index + 1}.`);
		// Next row in the same position, otherwise previous row, otherwise Add row. Removing
		// an unfocused row does not steal focus from another input or the toolbar.
		if (recoverFocus) await focusRow(rowIds[index] ?? rowIds[index - 1]);
	}
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<form method="POST" use:enhance novalidate data-hydrated={hydrated}>
	<p>
		Save URLs validates on the server, including without JavaScript. With JavaScript, add,
		reverse or remove rows; unchanged row errors stay with their URLs until the next save.
	</p>
	<Fieldset {form} name="urls" fieldErrors>
		<Legend>Website URLs</Legend>
		{#snippet description()}Enter one URL per row.{/snippet}
		{#each $formData.urls as _, index (rowIds[index])}
			<div id={`array-row-${rowIds[index]}`} data-row={index} data-row-id={rowIds[index]}>
				<ElementField {form} name={`urls[${index}]` as `urls[${number}]`} fieldErrors>
					{#snippet children({ value, tainted })}
						<output data-value={JSON.stringify(value)} data-tainted={tainted}
							>{value}</output
						>
						<Control id={`array-url-${rowIds[index]}`}>
							{#snippet children({ props })}
								<Label>URL {index + 1}</Label>
								<input {...props} bind:value={$formData.urls[index]} />
							{/snippet}
						</Control>
					{/snippet}
				</ElementField>
				<button
					type="button"
					aria-label={`Remove URL ${index + 1}`}
					disabled={!hydrated || $submitting}
					onclick={() => removeRow(rowIds[index])}>Remove row</button
				>
			</div>
		{/each}
	</Fieldset>
	<button type="button" bind:this={addButton} disabled={!hydrated || $submitting} onclick={addRow}
		>Add row</button
	>
	<button
		type="button"
		disabled={!hydrated || $submitting || rowIds.length < 2}
		onclick={reorderRows}>Reorder rows</button
	>
	<button
		type="button"
		disabled={!hydrated || $submitting || rowIds.length === 0}
		onclick={() => removeRow()}>Remove row</button
	>
	<div aria-live="polite" aria-atomic="true" data-testid="array-mutations">{mutationMessage}</div>
	<button type="submit">Save URLs</button>
</form>

{#if $posted}
	<output data-testid="submission-data">{JSON.stringify($formData)}</output>
	<output data-testid="submission-errors">{JSON.stringify($errors)}</output>
{/if}
{#if $message}
	<p role="status" data-testid="arrays-success">{$message}</p>
{/if}
