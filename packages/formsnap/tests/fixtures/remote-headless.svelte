<script lang="ts">
	import { useRemoteFormField } from "$lib/remote/index.js";

	let { prefix }: { prefix: string } = $props();
	const state = useRemoteFormField<{
		value(): string;
		issues(): { message: string; path: Array<string | number> }[] | undefined;
		touched(): boolean;
		dirty(): boolean;
	}>({
		descriptionId: () => `${prefix}-description`,
		errorsId: () => `${prefix}-errors`,
	});
</script>

<output data-headless-value>{state.field.value()}</output>
<p id={`${prefix}-description`}>Headless description</p>
<p id={`${prefix}-errors`}>{state.errors.join(", ")}</p>
