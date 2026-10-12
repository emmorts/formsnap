<script lang="ts" module>
	import type { RemoteFieldLike } from "./types.js";
	type F = unknown;
</script>

<script lang="ts" generics="F extends RemoteFieldLike">
	import { box } from "svelte-toolbelt";
	import { useId } from "$lib/internal/utils/id.js";
	import OwnedFieldContent from "$lib/components/owned-field-content.svelte";
	import { useRemoteField } from "./remote-field.svelte.js";
	import type { RemoteFieldProps } from "./types.js";

	const instanceId = $props.id();

	let {
		field,
		constraints = {},
		children,
		description,
		fieldErrors,
		descriptionId = useId(instanceId, "description"),
		fieldErrorsId = useId(instanceId, "errors"),
		fieldErrorsLive,
	}: RemoteFieldProps<F> = $props();

	const state = useRemoteField({
		field: box.with(() => field),
		constraints: box.with(() => constraints),
		descriptionId: box.with(() => (description ? descriptionId : undefined)),
		fieldErrorsId: box.with(() => (fieldErrors ? fieldErrorsId : undefined)),
	});
</script>

<!--
@component
## RemoteField
Provides the presentation scope for one selected field of a native SvelteKit remote form.

Unlike `Field`, there is no `form` prop and no Superforms state: the scope reads the field you pass,
plus Kit's issues, touched and dirty state. `RemoteControl`, `Label`, `Description`, `FieldErrors`
and `Legend` below it behave as they do for a Superforms field.

- [Remote functions guide](https://formsnap.dev/docs/guides/remote-functions)

### Snippet Props
- `value` - The selected subtree's value, as Kit returns it.
- `issues` - Kit's issues, with their structured paths.
- `errors` - The same issues as messages.
- `touched` - Kit's touched state. Not Superforms taint.
- `dirty` - Kit's dirty state. Not Superforms taint.
- `constraints` - The explicit constraints you passed.

@param {F} field - The selected Kit remote field, for example `myForm.fields.handle`.
-->

{@render children?.(state.snippetProps)}
<OwnedFieldContent
	{description}
	{fieldErrors}
	{descriptionId}
	{fieldErrorsId}
	{fieldErrorsLive}
	errors={state.errors}
/>
