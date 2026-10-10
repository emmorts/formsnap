<script lang="ts">
	import { useFormField } from "$lib/index.js";
	import type { SettingsData } from "../../src/routes/schema.js";

	let { show }: { show: boolean } = $props();

	// A headless consumer declares the description it renders and releases it by returning null.
	useFormField<SettingsData, "email">({
		descriptionId: () => (show ? "custom-help" : null),
	});
</script>

{#if show}
	<p id="custom-help">Your address is never shared.</p>
{/if}
