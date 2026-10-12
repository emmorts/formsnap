<script lang="ts">
	import { untrack } from "svelte";
	import { useFormField } from "$lib/index.js";
	import { getRemoteField, useRemoteFormField } from "$lib/remote/index.js";

	let { hook }: { hook: "root" | "remote" | "remote-state" } = $props();
	const state = untrack(() =>
		hook === "root"
			? useFormField({})
			: hook === "remote"
				? useRemoteFormField()
				: getRemoteField()
	);
</script>

<output>{JSON.stringify(state.errors)}</output>
