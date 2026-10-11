<script lang="ts">
	import { onMount } from "svelte";
	import { defaults, superForm } from "sveltekit-superforms";
	import { zod, zodClient } from "sveltekit-superforms/adapters";
	import { z } from "zod/v3";
	import { Control, Field, Label } from "@emmorts/formsnap";
	import {
		demoBoxClass,
		errorClass,
		fieldClass,
		hintClass,
		inputClass,
		labelClass,
		submitClass,
	} from "$lib/demos/input-classes";

	// Client-side demo: SPA mode validates against the same schema, no server involved.
	const schema = z.object({
		name: z.string().min(2, "Tell us your name (2+ characters)"),
		email: z.string().email("That email doesn't look right"),
	});

	let submitted = $state(false);
	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	const form = superForm(defaults(zod(schema)), {
		SPA: true,
		validators: zodClient(schema),
		resetForm: false,
		onUpdate({ form }) {
			if (form.valid) submitted = true;
		},
	});
	const { form: formData, enhance, submitting } = form;
</script>

<div class={demoBoxClass}>
	{#if submitted}
		<div role="status" class="flex flex-col items-center gap-3 py-10 text-center">
			<span
				class="bg-mint-400/15 text-mint-400 flex size-11 items-center justify-center rounded-full"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					class="size-5"
					aria-hidden="true"
				>
					<path d="M5 13l4 4L19 7" />
				</svg>
			</span>
			<p class="font-display text-fg text-lg font-semibold">
				Validation passed, {$formData.name}.
			</p>
			<p class="text-fg-muted text-sm">
				This example runs in your browser. No data was saved and no email was sent.
			</p>
			<button
				type="button"
				onclick={() => {
					submitted = false;
					form.reset();
				}}
				class="border-line text-fg-muted hover:text-fg mt-2 rounded-lg border px-3 py-1.5 text-sm transition-colors"
			>
				Try again
			</button>
		</div>
	{:else}
		<form method="POST" use:enhance class="flex flex-col gap-5">
			<div class={fieldClass}>
				<Field {form} name="name">
					<Control>
						{#snippet children({ props })}
							<Label class={labelClass}>Name</Label>
							<input
								{...props}
								type="text"
								placeholder="Ada Lovelace"
								class={inputClass}
								bind:value={$formData.name}
							/>
						{/snippet}
					</Control>
					{#snippet fieldErrors({ errors, errorProps })}
						{#each errors as error (error)}
							<p {...errorProps} class={errorClass}>{error}</p>
						{/each}
					{/snippet}
				</Field>
			</div>

			<div class={fieldClass}>
				<Field {form} name="email">
					<Control>
						{#snippet children({ props })}
							<Label class={labelClass}>Email</Label>
							<input
								{...props}
								type="email"
								placeholder="ada@analytical.engine"
								class={inputClass}
								bind:value={$formData.email}
							/>
						{/snippet}
					</Control>
					{#snippet description()}
						<p class={hintClass}>Use an example address. No email is sent.</p>
					{/snippet}
					{#snippet fieldErrors({ errors, errorProps })}
						{#each errors as error (error)}
							<p {...errorProps} class={errorClass}>{error}</p>
						{/each}
					{/snippet}
				</Field>
			</div>

			<p class={hintClass}>
				Client-only demo: no data is submitted or saved. JavaScript is required.
			</p>
			<button type="submit" disabled={!hydrated || $submitting} class={submitClass}>
				{$submitting ? "Validating…" : "Validate example"}
			</button>
		</form>
	{/if}
</div>
