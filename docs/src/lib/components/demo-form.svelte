<script lang="ts">
	import { defaults, superForm } from "sveltekit-superforms";
	import { zod, zodClient } from "sveltekit-superforms/adapters";
	import { z } from "zod/v3";
	import { Control, Field, Label } from "@emmorts/formsnap";

	// Client-side demo: SPA mode validates against the same schema, no server involved.
	const schema = z.object({
		name: z.string().min(2, "Tell us your name (2+ characters)"),
		email: z.string().email("That email doesn't look right"),
	});

	let submitted = $state(false);

	const form = superForm(defaults(zod(schema)), {
		SPA: true,
		validators: zodClient(schema),
		resetForm: false,
		onUpdate({ form }) {
			if (form.valid) submitted = true;
		},
	});
	const { form: formData, enhance, submitting } = form;

	const inputClass =
		"w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-accent aria-[invalid=true]:border-rose-400";
</script>

<div class="border-line bg-surface-raised rounded-xl border p-5 sm:p-6">
	{#if submitted}
		<div class="flex flex-col items-center gap-3 py-10 text-center">
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
				You're on the list, {$formData.name}.
			</p>
			<p class="text-fg-muted text-sm">Confirmation sent to {$formData.email}.</p>
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
			<Field {form} name="name">
				<Control>
					{#snippet children({ props })}
						<Label class="text-fg mb-1.5 block text-sm font-medium">Name</Label>
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
						<p {...errorProps} class="mt-1.5 text-sm text-rose-400">{error}</p>
					{/each}
				{/snippet}
			</Field>

			<Field {form} name="email">
				<Control>
					{#snippet children({ props })}
						<Label class="text-fg mb-1.5 block text-sm font-medium">Email</Label>
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
					<p class="text-fg-muted mt-1.5 text-sm">
						One email when we ship. No newsletter.
					</p>
				{/snippet}
				{#snippet fieldErrors({ errors, errorProps })}
					{#each errors as error (error)}
						<p {...errorProps} class="mt-1.5 text-sm text-rose-400">{error}</p>
					{/each}
				{/snippet}
			</Field>

			<button
				type="submit"
				disabled={$submitting}
				class="bg-accent text-accent-contrast rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
			>
				{$submitting ? "Joining…" : "Get early access"}
			</button>
		</form>
	{/if}
</div>
