<script lang="ts">
	import { useFormControl } from "$lib/index.js";

	// `useFormControl` reads the enclosing `Control`'s context, so a custom widget can apply the
	// same `id`, `name` and ARIA props that a plain `<input {...props} />` would receive.
	let {
		value = $bindable(4),
		ref = $bindable<HTMLInputElement | null>(null),
	}: { value?: number; ref?: HTMLInputElement | null } = $props();

	const control = useFormControl({});
</script>

<input type="range" min="1" max="5" step="1" {...control.props} bind:value bind:this={ref} />
