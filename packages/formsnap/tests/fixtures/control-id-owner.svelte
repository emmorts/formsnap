<script lang="ts">
	import { useFormControl } from "$lib/index.js";

	let { owner, id }: { owner: string; id: string | null } = $props();
	const control = useFormControl({ id: () => id });
</script>

<output
	data-control-owner={owner}
	data-id={control.id}
	data-props-id={control.props.id}
	data-label-for={control.labelProps.for}
></output>
