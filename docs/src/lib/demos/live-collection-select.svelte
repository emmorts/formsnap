<script lang="ts">
	import { Select } from "bits-ui";
	import { useFormControl } from "@emmorts/formsnap";
	import { inputClass, labelClass } from "./input-classes";

	let {
		value = $bindable(""),
		open = $bindable(false),
		disabled = false,
		ref = $bindable<HTMLButtonElement | null>(null),
	}: {
		value?: string;
		open?: boolean;
		disabled?: boolean;
		ref?: HTMLButtonElement | null;
	} = $props();
	const control = useFormControl({});
	const options = [
		{ value: "central", label: "Central depot" },
		{ value: "closed", label: "Closed depot (unavailable)", disabled: true },
		{ value: "east", label: "East depot" },
	];
	const selectedLabel = $derived(options.find((option) => option.value === value)?.label);
</script>

<span
	id={control.labelProps.id}
	class={labelClass}
	data-fs-label=""
	data-fs-error={control.labelProps["data-fs-error"]}>Collection point</span
>
<!-- Bits owns interaction and popup ARIA. Map only Formsnap's association attributes
     to the real focusable trigger, not to the hidden submission transport. -->
<Select.Root type="single" bind:value bind:open {disabled} items={options}>
	<Select.Trigger
		id={control.props.id}
		bind:ref
		aria-labelledby={control.labelProps.id}
		aria-describedby={control.props["aria-describedby"]}
		aria-invalid={control.props["aria-invalid"]}
		aria-required={control.props["aria-required"]}
		data-fs-control=""
		data-fs-error={control.props["data-fs-error"]}
		class={`${inputClass} flex items-center justify-between gap-2 text-left disabled:opacity-50`}
	>
		{selectedLabel ?? "Choose a collection point"}<span aria-hidden="true">▾</span>
	</Select.Trigger>
	<Select.Content
		sideOffset={4}
		class="docs-collection-options border-line bg-surface text-fg z-50 max-w-[calc(100vw-2rem)] rounded-lg border p-1 shadow-lg"
	>
		<Select.Viewport>
			{#each options as option (option.value)}
				<Select.Item
					value={option.value}
					label={option.label}
					disabled={option.disabled}
					aria-disabled={option.disabled || undefined}
					class="cursor-default rounded-md px-3 py-2 text-sm"
				>
					{#snippet children({ selected })}
						{option.label}{#if selected}<span aria-hidden="true"> ✓</span>{/if}
					{/snippet}
				</Select.Item>
			{/each}
		</Select.Viewport>
	</Select.Content>
</Select.Root>
<!-- No ID, label or ARIA on transport; Root has no name and cannot submit twice. -->
<input type="hidden" name={control.props.name} {value} {disabled} />

<style>
	:global(.docs-collection-options [data-highlighted]) {
		outline: 2px solid currentColor;
		outline-offset: -2px;
	}
	:global(.docs-collection-options [data-disabled]) {
		opacity: 0.5;
	}
</style>
