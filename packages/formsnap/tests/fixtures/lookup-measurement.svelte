<script lang="ts">
	import { untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Field } from "$lib/index.js";

	let {
		validated,
		names,
	}: {
		validated: SuperValidated<Record<string, string>>;
		names: string[];
	} = $props();

	const form = superForm(untrack(() => validated));
	const initialNames = untrack(() => names);
	form.tainted.set(Object.fromEntries(initialNames.map((name) => [name, true])));

	// Exercise the real writable stores, keeping each metadata root object in place.
	// No value writes or input events: those would introduce validation/taint scheduling.
	export function updateField(step: number) {
		const name = initialNames[0]!;
		// Superforms' default reconciliation clears Previous before reading New.
		// Its public force option permits a same-object update without clearing siblings.
		form.errors.update(
			(errors) => {
				errors[name] = [`updated-${name}-${step}`];
				return errors;
			},
			{ force: true }
		);
		form.constraints.update((constraints) => {
			constraints[name]!.minlength = 2 + (step % 2);
			return constraints;
		});
		form.tainted.update((tainted) => {
			tainted![name] = step % 2 === 0;
			return tainted;
		});
	}
</script>

<form>
	{#each names as name (name)}
		<Field {form} {name}>
			{#snippet children({ errors, constraints, tainted })}
				<output
					data-field={name}
					data-errors={JSON.stringify(errors)}
					data-constraints={JSON.stringify(constraints)}
					data-tainted={String(tainted)}
				></output>
			{/snippet}
		</Field>
	{/each}
</form>
