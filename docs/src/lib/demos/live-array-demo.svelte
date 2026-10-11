<script lang="ts">
	import { Control, ElementField, Fieldset, Label, Legend } from "@emmorts/formsnap";
	import { superForm } from "sveltekit-superforms";
	import { zodClient } from "sveltekit-superforms/adapters";
	import { z } from "zod/v3";
	import {
		demoBoxClass,
		errorClass,
		fieldClass,
		inputClass,
		labelClass,
		secondaryButtonClass,
		submitClass,
	} from "./input-classes";

	// A browser-only primitive array: Superforms' SPA mode validates it, so the fieldset, the
	// per-row fields and their error regions all run without a server.
	const schema = z.object({
		invites: z
			.array(z.string().email("Enter a valid email address."))
			.min(1, "Keep at least one invite.")
			.max(3, "Three invites at a time."),
	});

	let saved = $state(false);

	const form = superForm(
		{ invites: ["", ""] },
		{
			SPA: true,
			validators: zodClient(schema),
			resetForm: false,
			onUpdate({ form }) {
				if (form.valid) saved = true;
			},
		}
	);
	const { form: formData, enhance, submitting } = form;

	// Superforms replaces row objects as taint updates, so object identity is not a stable key.
	// Keep a separate list of ids and mutate it in lockstep with the values.
	let nextId = 2;
	let rowIds = $state([0, 1]);

	function addRow() {
		rowIds = [...rowIds, nextId++];
		$formData.invites = [...$formData.invites, ""];
	}

	function removeRow(index: number) {
		rowIds = rowIds.filter((_, rowIndex) => rowIndex !== index);
		$formData.invites = $formData.invites.filter((_, rowIndex) => rowIndex !== index);
	}
</script>

<div class={demoBoxClass}>
	{#if saved}
		<div class="flex flex-wrap items-center justify-between gap-3">
			<p class="text-fg text-sm">
				Validation passed — {$formData.invites.length} invite{$formData.invites.length === 1
					? ""
					: "s"} would be sent.
			</p>
			<button
				type="button"
				class={secondaryButtonClass}
				onclick={() => {
					saved = false;
					form.reset();
				}}
			>
				Reset
			</button>
		</div>
	{:else}
		<form method="POST" use:enhance class="flex flex-col gap-4">
			<Fieldset {form} name="invites" fieldErrors>
				<Legend class="text-fg mb-3 text-sm font-medium">Invites</Legend>

				<div class="flex flex-col gap-3">
					{#each $formData.invites as _, index (rowIds[index])}
						<div class={fieldClass}>
							<ElementField {form} name={`invites[${index}]` as `invites[${number}]`}>
								<Control>
									{#snippet children({ props })}
										<Label class={labelClass}>Invite {index + 1}</Label>
										<div class="flex items-start gap-2">
											<input
												{...props}
												type="email"
												placeholder="ada@example.com"
												class={inputClass}
												bind:value={$formData.invites[index]}
											/>
											<button
												type="button"
												class={secondaryButtonClass}
												disabled={$formData.invites.length === 1}
												onclick={() => removeRow(index)}
											>
												Remove
											</button>
										</div>
									{/snippet}
								</Control>
								{#snippet fieldErrors({ errors, errorProps })}
									{#each errors as error (error)}
										<p {...errorProps} class={errorClass}>{error}</p>
									{/each}
								{/snippet}
							</ElementField>
						</div>
					{/each}
				</div>
			</Fieldset>

			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class={secondaryButtonClass}
					disabled={$formData.invites.length >= 3}
					onclick={addRow}
				>
					Add invite
				</button>
				<button type="submit" disabled={$submitting} class={submitClass}>
					{$submitting ? "Checking…" : "Save invites"}
				</button>
			</div>
		</form>
	{/if}
</div>
