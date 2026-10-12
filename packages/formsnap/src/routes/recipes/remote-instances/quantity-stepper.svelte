<script lang="ts">
	import { onMount } from "svelte";
	import { useRemoteFormField } from "@emmorts/formsnap/remote";
	import type { saveOrderLine } from "./save.remote.js";

	type QuantityField = ReturnType<typeof saveOrderLine.for>["fields"]["quantity"];

	let {
		inputId,
		default: defaultValue,
	}: {
		inputId: string;
		default: number;
	} = $props();
	const quantity = useRemoteFormField<QuantityField>();

	// An unset Kit value falls back to the rendered default, not an empty control.
	const shown = $derived.by(() => {
		const value = quantity.field.value();
		return typeof value === "number" ? value : defaultValue;
	});

	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});

	function step(delta: number) {
		quantity.field.set(Math.min(5, Math.max(1, shown + delta)));
	}
</script>

<!-- The range is a hint for the buttons. What a line actually allows is the server's record. -->
<span data-testid={`${inputId}-stepper`} data-enhancement-only="">
	<button
		type="button"
		aria-controls={inputId}
		disabled={!hydrated}
		onclick={() => step(-1)}
		data-testid={`${inputId}-fewer`}>Fewer</button
	>
	<output for={inputId} data-testid={`${inputId}-readout`}>{shown}</output>
	<button
		type="button"
		aria-controls={inputId}
		disabled={!hydrated}
		onclick={() => step(1)}
		data-testid={`${inputId}-more`}>More</button
	>
</span>
