<script lang="ts">
	import { box, mergeProps } from "svelte-toolbelt";
	import type { FieldErrorsProps } from "./types.js";
	import { useId } from "$lib/internal/utils/index.js";
	import { useFieldErrors } from "$lib/formsnap.svelte.js";
	import ErrorContent from "./error-content.svelte";

	const instanceId = $props.id();

	let {
		id = useId(instanceId),
		ref = $bindable(null),
		live,
		children,
		child,
		...restProps
	}: FieldErrorsProps = $props();

	// Precedence: the `live` prop, then an `aria-live` passed with the other attributes, then the
	// default. Generated attributes win over the spread on the element, so a policy has to be
	// resolved before they are merged.
	const livePolicy = $derived(live ?? restProps["aria-live"] ?? "assertive");

	const fieldErrorsState = useFieldErrors({
		id: box.with(() => id),
		ref: box.with(
			() => ref,
			(v) => (ref = v)
		),
		live: box.with(() => livePolicy),
	});

	const mergedProps = $derived(mergeProps(restProps, fieldErrorsState.fieldErrorsProps));
</script>

<!--
@component
## FieldErrors
A component that renders the container for validation errors for a [Field](https://formsnap.dev/docs/components/field), [Fieldset](https://formsnap.dev/docs/components/fieldset), or [ElementField](https://formsnap.dev/docs/components/element-field).

- [FieldErrors Documentation](https://formsnap.dev/docs/components/field-errors)

### Snippet Props
- `errors` - An array of errors for the associated field.
- `fieldErrorsAttrs` - A spreadable object of attributes for the container element if `child` snippet is used.
- `errorAttrs` - A spreadable object of attributes for the individual error elements if `child` snippet is used.

@param {string} [id] - The id of the field errors container.
@param {FieldErrorsLive} [live] - The announcement policy for the container. Defaults to `"assertive"`.
-->
{#if child}
	{@render child({
		props: mergedProps,
		...fieldErrorsState.snippetProps,
	})}
{:else}
	<div {...mergedProps}>
		{#if children}
			{@render children(fieldErrorsState.snippetProps)}
		{:else}
			<ErrorContent
				errors={fieldErrorsState.field.errors}
				errorProps={fieldErrorsState.errorProps}
			/>
		{/if}
	</div>
{/if}
