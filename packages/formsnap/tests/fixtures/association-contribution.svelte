<script lang="ts">
	import { useFormField } from "$lib/index.js";

	let {
		owner,
		descriptionId,
		errorsId,
	}: {
		owner: string;
		descriptionId: string | null;
		errorsId: string | null;
	} = $props();

	const field = useFormField({
		descriptionId: () => descriptionId,
		errorsId: () => errorsId,
	});
</script>

<output data-owner={owner} data-description={field.descriptionId} data-errors={field.errorsId}
></output>
