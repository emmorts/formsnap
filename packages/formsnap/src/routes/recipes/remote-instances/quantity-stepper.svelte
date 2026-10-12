<script lang="ts">
	import { onMount } from "svelte";

	/**
	 * The custom control: two buttons and a readout around the native number input the page renders.
	 * It is enhancement-only, so it stays disabled until the page has hydrated, and the native input
	 * remains the control that submits.
	 *
	 * The readout comes from the field's own state with the *rendered* default as its fallback: an
	 * unset `value()` means nothing has been typed yet, not that the field is empty. Because the
	 * readout keeps no copy of its own, Kit's reset contract keeps it in step — a reset reads the
	 * rendered defaults back into the field, and this renders from there.
	 */
	type SteppableField = {
		value(): unknown;
		set(input: number): unknown;
	};

	let {
		field,
		inputId,
		default: defaultValue,
	}: {
		field: SteppableField;
		inputId: string;
		default: number;
	} = $props();

	const shown = $derived.by(() => {
		const value = field.value();
		return typeof value === "number" ? value : defaultValue;
	});

	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});

	/**
	 * One write to the field. The state changes, the native control it is spread on renders that
	 * value, and the submission carries it: the three cannot disagree, because there is only one
	 * source.
	 */
	function step(delta: number) {
		field.set(Math.min(5, Math.max(1, shown + delta)));
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
