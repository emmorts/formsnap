<script lang="ts">
	import { box } from "svelte-toolbelt";
	import { useId } from "$lib/internal/utils/id.js";
	import { useControl } from "$lib/internal/presentation.svelte.js";
	import type { RemoteControlProps } from "./types.js";

	const instanceId = $props.id();
	const labelId = useId(instanceId, "label");

	let { id = useId(instanceId), children }: RemoteControlProps = $props();

	const controlState = useControl({
		id: box.with(() => id),
		labelId: box.with(() => labelId),
	});
</script>

<!--
@component
## RemoteControl
Associates a `Label` with a control of a native SvelteKit remote form, and contributes Formsnap's
attributes for it.

Spread the Kit props from `field.as(...)` and the `props` this passes, in any order: they share no
key. Kit owns `name` and `aria-invalid`, so Formsnap contributes neither, and nothing has to be
removed or overridden. `aria-required` comes from the explicit `constraints` you passed to
`RemoteField`; it never adds a native `required` attribute, so constraint validation stays yours to
choose.

- [Remote functions guide](https://formsnap.dev/docs/guides/remote-functions)

### Snippet Props
- `props` - The attributes Formsnap contributes, such as `id`, `aria-describedby` and the styling
  attributes. They never include `name` or `aria-invalid`.
-->

{@render children?.({ props: controlState.transportProps })}
