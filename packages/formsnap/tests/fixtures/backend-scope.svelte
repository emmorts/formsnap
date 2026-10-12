<script lang="ts">
	import { superForm } from "sveltekit-superforms";
	import { Field } from "$lib/index.js";
	import { RemoteField } from "$lib/remote/index.js";
	import BackendHook from "./backend-hook.svelte";

	let {
		scope,
		hook,
	}: {
		scope: "root" | "remote";
		hook: "root" | "remote" | "remote-state";
	} = $props();

	const form = superForm({ handle: "Ada" });
	const field = {
		value: () => "Ada",
		issues: () => undefined,
		touched: () => false,
		dirty: () => false,
	};
</script>

{#if scope === "root"}
	<Field {form} name="handle"><BackendHook {hook} /></Field>
{:else}
	<RemoteField {field}><BackendHook {hook} /></RemoteField>
{/if}
