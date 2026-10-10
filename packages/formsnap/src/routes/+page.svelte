<script lang="ts">
	import type { SuperValidated } from "sveltekit-superforms";
	import SettingsForm from "./settings-form.svelte";
	import type { SettingsData } from "./schema.js";

	let { data }: { data: { form: SuperValidated<SettingsData> } } = $props();
</script>

<SettingsForm validated={data.form} />
