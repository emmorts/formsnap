<script lang="ts">
	import { useFormControl } from "$lib/index.js";

	let { fallback = false }: { fallback?: boolean } = $props();
	const control = useFormControl({});
</script>

{#if fallback}
	<span {...control.labelProps} data-fallback-label>Fallback widget label</span>
{/if}
<button type="button" {...control.props} aria-labelledby={control.labelProps.id} data-widget>
	Widget
</button>
<output data-selected-label={control.labelProps.id} data-label-for={control.labelProps.for}
></output>
