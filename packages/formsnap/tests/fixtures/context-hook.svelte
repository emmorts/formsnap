<script lang="ts">
	import { untrack } from "svelte";
	import { useFormControl, useFormField } from "$lib/index.js";

	let { kind }: { kind: "field" | "control" } = $props();
	// Read the returned state as a headless consumer would, including on the server.
	const state = untrack(() => (kind === "field" ? useFormField({}) : useFormControl({})));
</script>

{#if "errors" in state}
	<output data-hook="field">{JSON.stringify(state.errors)}</output>
{:else}
	<input {...state.props} data-hook="control" />
{/if}
