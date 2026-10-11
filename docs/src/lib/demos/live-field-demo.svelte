<script lang="ts">
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

	// A browser-only Formsnap form: Superforms' SPA mode validates against the same schema the
	// guides use, with no server or load function involved.
	const schema = z.object({
		email: z.string().email("Enter an address we can reach you at."),
	});

	let passed = $state(false);

	const form = superForm(
		{ email: "" },
		{
			SPA: true,
			validators: zodClient(schema),
			resetForm: false,
			onUpdate({ form }) {
				if (form.valid) passed = true;
			},
		}
	);
	const { form: formData, enhance, submitting } = form;
</script>

<div class={demoBoxClass}>
	{#if passed}
		<div class="flex flex-wrap items-center justify-between gap-3">
			<p class="text-fg text-sm">
				Validation passed — <span class="font-mono">{$formData.email}</span> would be sent.
			</p>
			<button
				type="button"
				class={secondaryButtonClass}
				onclick={() => {
					passed = false;
					form.reset();
				}}
			>
				Reset
			</button>
		</div>
	{:else}
		<form method="POST" use:enhance class="flex flex-col gap-4">
			<div class={fieldClass}>
				<Field {form} name="email">
					<Control>
						{#snippet children({ props })}
							<Label class={labelClass}>Email</Label>
							<input
								{...props}
								type="email"
								placeholder="ada@example.com"
								class={inputClass}
								bind:value={$formData.email}
							/>
						{/snippet}
					</Control>
					{#snippet description()}
						<p class={hintClass}>
							The label and this description are associated with the input.
						</p>
					{/snippet}
					{#snippet fieldErrors({ errors, errorProps })}
						{#each errors as error (error)}
							<p {...errorProps} class={errorClass}>{error}</p>
						{/each}
					{/snippet}
				</Field>
			</div>

			<div>
				<button type="submit" disabled={$submitting} class={submitClass}>
					{$submitting ? "Checking…" : "Submit"}
				</button>
			</div>
		</form>
	{/if}
</div>
