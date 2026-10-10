<script lang="ts" module>
	import type { FormPath as _FormPath } from "sveltekit-superforms";
	type T = unknown;
	type U = unknown;
</script>

<script lang="ts" generics="T extends Record<string, unknown>, U extends _FormPath<T>">
	import { box, mergeProps, useRefById } from "svelte-toolbelt";
	import type { FieldsetProps } from "./types.js";
	import { useField } from "$lib/formsnap.svelte.js";
	import OwnedFieldContent from "./owned-field-content.svelte";
	import { getDataFsError } from "$lib/internal/utils/attributes.js";
	import { useId } from "$lib/internal/utils/id.js";

	const instanceId = $props.id();

	let {
		id = useId(instanceId),
		ref = $bindable(null),
		form,
		name,
		child: childProp,
		children: childrenProp,
		description,
		fieldErrors,
		descriptionId = useId(instanceId, "description"),
		fieldErrorsId = useId(instanceId, "errors"),
		fieldErrorsLive,
		...restProps
	}: FieldsetProps<T, U> = $props();

	const fieldState = useField({
		form: box.with(() => form),
		name: box.with(() => name),
		descriptionId: box.with(() => (description ? descriptionId : undefined)),
		fieldErrorsId: box.with(() => (fieldErrors ? fieldErrorsId : undefined)),
	});

	const customChild = $derived.by(() => {
		if (childProp && (description || fieldErrors)) {
			throw new Error(
				"Fieldset child cannot be combined with owned description or fieldErrors content."
			);
		}
		return childProp;
	});

	useRefById({
		id: box.with(() => id),
		ref: box.with(
			() => ref,
			(v) => (ref = v)
		),
	});

	const mergedProps = $derived(
		mergeProps(restProps, {
			id,
			"data-fs-fieldset": "",
		})
	);
</script>

<!--
@component
## Fieldset
A component that groups related form controls or fields and extends the [Field](https://formsnap.dev/docs/components/field) component.

- [Fieldset Documentation](https://formsnap.dev/docs/components/fieldset)
- [Field Documentation](https://formsnap.dev/docs/components/field)

### Snippet Props
- `value` - The value of the field.
- `errors` - The errors of the field.
- `tainted` - The tainted state of the field.
- `constraints` - The constraints of the field.
- `props` - A spreadable object of attributes for the fieldset element if using the `child` snippet.

@param {SuperForm} form - The form object.
@param {FormPath<T>} name - The name of the field.
-->
{#if customChild}
	{@render customChild({
		props: mergedProps,
		...fieldState.snippetProps,
	})}
{:else}
	<fieldset {...mergedProps} data-fs-error={getDataFsError(fieldState.errors)}>
		{@render childrenProp?.(fieldState.snippetProps)}
		<OwnedFieldContent
			{description}
			{fieldErrors}
			{descriptionId}
			{fieldErrorsId}
			{fieldErrorsLive}
			errors={fieldState.errors}
		/>
	</fieldset>
{/if}
