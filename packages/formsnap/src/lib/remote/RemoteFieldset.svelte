<script lang="ts" module>
	import type { RemoteFieldLike } from "./types.js";
	type F = unknown;
</script>

<script lang="ts" generics="F extends RemoteFieldLike">
	import { box, useRefById } from "svelte-toolbelt";
	import { useId } from "$lib/internal/utils/id.js";
	import { getDataFsError } from "$lib/internal/utils/attributes.js";
	import OwnedFieldContent from "$lib/components/owned-field-content.svelte";
	import { useRemoteField } from "./remote-field.svelte.js";
	import type { RemoteFieldsetProps } from "./types.js";

	const instanceId = $props.id();

	let {
		id = useId(instanceId),
		ref = $bindable(null),
		field,
		constraints = {},
		child: childProp,
		children: childrenProp,
		description,
		fieldErrors,
		descriptionId = useId(instanceId, "description"),
		fieldErrorsId = useId(instanceId, "errors"),
		fieldErrorsLive,
	}: RemoteFieldsetProps<F> = $props();

	const state = useRemoteField({
		field: box.with(() => field),
		constraints: box.with(() => constraints),
		descriptionId: box.with(() => (description ? descriptionId : undefined)),
		fieldErrorsId: box.with(() => (fieldErrors ? fieldErrorsId : undefined)),
	});

	const customChild = $derived.by(() => {
		if (childProp && (description || fieldErrors)) {
			throw new Error(
				"RemoteFieldset child cannot be combined with owned description or fieldErrors content."
			);
		}
		return childProp;
	});

	useRefById({
		id: box.with(() => id),
		ref: box.with(
			() => ref,
			(value) => (ref = value)
		),
	});

	const mergedProps = $derived({
		id,
		"data-fs-fieldset": "",
		"data-fs-error": getDataFsError(state.errors),
	});
</script>

<!--
@component
## RemoteFieldset
Groups the controls of a native SvelteKit remote form, for a field that is a group rather than a
single value, and extends `RemoteField` with a native `<fieldset>` element and `Legend` support.

A Kit group has `issues()` and `allIssues()` but no `as()`, so it cannot be presented as one
control; that is what this component is for. Put a `Legend` inside it for an accessible title.

- [Remote forms](https://emmorts.github.io/formsnap/docs/recipes/remote-forms)
-->

{#if customChild}
	{@render customChild({
		props: mergedProps,
		...state.snippetProps,
	})}
{:else}
	<fieldset {...mergedProps}>
		{@render childrenProp?.(state.snippetProps)}
		<OwnedFieldContent
			{description}
			{fieldErrors}
			{descriptionId}
			{fieldErrorsId}
			{fieldErrorsLive}
			errors={state.errors}
		/>
	</fieldset>
{/if}
