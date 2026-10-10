<script lang="ts">
	import { box } from "svelte-toolbelt";
	import type { ControlProps } from "./types.js";
	import { useId } from "$lib/internal/utils/index.js";
	import { useControl } from "$lib/formsnap.svelte.js";

	const instanceId = $props.id();
	const labelId = useId(instanceId, "label");

	let { id = useId(instanceId), children }: ControlProps = $props();

	const controlState = useControl({
		id: box.with(() => id),
		labelId: box.with(() => labelId),
	});
</script>

<!--
@component
## Control
Associates a [Label](https://formsnap.dev/docs/components/label) with and provides necessary attributes for a form control.

- [Control Documentation](https://formsnap.dev/docs/components/label)

@example
```svelte
<Control>
  {#snippet children({ props })}
	<Label>Name</Label>
	<input type="text" {...props} bind:value={$formData.name} />
   {/snippet}
</Control>
```

### Snippet Props
- `props` - A spreadable object of attributes that must be applied to the form control element.
-->
{@render children?.({ props: controlState.props })}
