<script lang="ts">
	import type { SuperValidated } from "sveltekit-superforms";
	import OwnedForm from "./owned-form.svelte";
	import OwnedFieldset from "./owned-fieldset.svelte";
	import type { OwnedData } from "./schema.js";

	let {
		data,
	}: {
		data: {
			form: SuperValidated<OwnedData>;
			localInitially: boolean;
			conflictMode?: "description" | "default-errors" | "custom-errors" | "disabled";
		};
	} = $props();
</script>

{#if data.conflictMode}
	<OwnedFieldset validated={data.form} mode={data.conflictMode} />
{:else}
	<OwnedForm validated={data.form} localInitially={data.localInitially} />
{/if}
