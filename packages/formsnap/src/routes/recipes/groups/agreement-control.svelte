<script lang="ts">
	import { useFormControl } from "$lib/index.js";

	let {
		value = $bindable(false),
		disabled = false,
		describedBy,
		ref = $bindable<HTMLButtonElement | null>(null),
	}: {
		value?: boolean;
		disabled?: boolean;
		describedBy: string;
		ref?: HTMLButtonElement | null;
	} = $props();

	const control = useFormControl({});
</script>

<!-- The button is the focus target; its native activation handles both Space and Enter. -->
<span
	id={control.labelProps.id}
	data-fs-label=""
	data-fs-error={control.labelProps["data-fs-error"]}>Accept custom terms</span
>
<button
	{...control.props}
	type="button"
	role="checkbox"
	aria-checked={value}
	aria-labelledby={control.labelProps.id}
	aria-describedby={describedBy}
	{disabled}
	bind:this={ref}
	onclick={() => (value = !value)}
>
	{value ? "Accepted" : "Not accepted"}
</button>

<!-- Only this input transports the value. It is not a second accessible control. -->
<input type="hidden" name={control.props.name} value={value ? "true" : "false"} {disabled} />
