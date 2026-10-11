<script lang="ts">
	import { fromStore } from "svelte/store";
	import { useFormField } from "$lib/index.js";
	import type { ReactivityData } from "./reactivity-schema.js";

	let { view }: { view: string } = $props();
	const field = useFormField<ReactivityData>({});
	const values = fromStore(field.form.form);
</script>

<output
	data-hook={view}
	data-owner-value={values.current.profile.name}
	data-tainted={String(field.tainted)}
	data-errors={JSON.stringify(field.errors)}
></output>
