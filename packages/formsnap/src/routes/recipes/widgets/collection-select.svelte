<script lang="ts">
	import { Select } from "bits-ui";
	import { useFormControl } from "$lib/index.js";
	import { collectionOptions } from "./schema.js";

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
	const selectedLabel = $derived(
		collectionOptions.find((option) => option.value === value)?.label
	);
</script>

<span
	id={control.labelProps.id}
	data-fs-label=""
	data-fs-error={control.labelProps["data-fs-error"]}>Collection point</span
>
<!-- No Root name: submission is separate from the library's interaction state. Bits owns
     role, expanded/controls/activedescendant, event handlers, and keyboard behavior. Map only
     Formsnap's identity, naming and validation attributes to the actual focusable trigger. -->
<Select.Root type="single" bind:value bind:open {disabled} items={collectionOptions}>
	<Select.Trigger
		id={control.props.id}
		bind:ref
		aria-labelledby={control.labelProps.id}
		aria-describedby={control.props["aria-describedby"]}
		aria-invalid={control.props["aria-invalid"]}
		aria-required={control.props["aria-required"]}
		data-fs-control=""
		data-fs-error={control.props["data-fs-error"]}
	>
		{selectedLabel ?? "Choose a collection point"}
	</Select.Trigger>
	<Select.Content sideOffset={4} class="collection-options">
		<Select.Viewport>
			{#each collectionOptions as option (option.value)}
				<Select.Item value={option.value} label={option.label} disabled={option.disabled}>
					{#snippet children({ selected })}
						{option.label}{#if selected}<span aria-hidden="true"> ✓</span>{/if}
					{/snippet}
				</Select.Item>
			{/each}
		</Select.Viewport>
	</Select.Content>
</Select.Root>
<!-- Transport gets only a name, value and disabled state: never the trigger ID or ARIA. -->
<input type="hidden" name={control.props.name} {value} {disabled} />

<style>
	:global(.collection-options) {
		background: white;
		color: black;
		border: 1px solid currentColor;
		padding: 0.5rem;
		z-index: 10;
	}
	:global(.collection-options [data-select-item]) {
		padding: 0.5rem;
	}
	:global(.collection-options [data-highlighted]) {
		outline: 2px solid currentColor;
	}
	:global(.collection-options [data-disabled]) {
		opacity: 0.5;
	}
</style>
