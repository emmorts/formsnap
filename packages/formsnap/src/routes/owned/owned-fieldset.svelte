<script lang="ts">
	import { untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Fieldset } from "$lib/index.js";
	import type { OwnedData } from "./schema.js";

	let {
		validated,
		mode,
	}: {
		validated: SuperValidated<OwnedData>;
		mode: "description" | "default-errors" | "custom-errors" | "disabled";
	} = $props();
	const form = superForm(untrack(() => validated));
	// Model an untyped consumer so the runtime guard is tested independently of public types.
	const ownedProps = $derived({
		description: mode === "description" ? help : undefined,
		fieldErrors:
			mode === "default-errors" ? true : mode === "custom-errors" ? errorContent : false,
		descriptionId: "unused-custom-help",
		fieldErrorsId: "unused-custom-errors",
	} as Record<never, never>);
</script>

{#snippet help()}Owned help{/snippet}
{#snippet errorContent()}Owned errors{/snippet}
{#snippet custom({ props }: { props: Record<string, unknown> })}
	<section {...props} data-custom-group>Caller-owned group</section>
{/snippet}

<Fieldset {form} name="urls" child={custom} {...ownedProps} />
