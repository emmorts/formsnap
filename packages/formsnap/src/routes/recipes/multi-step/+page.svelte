<script lang="ts">
	import { resolve } from "$app/paths";
	import type { SuperValidated } from "sveltekit-superforms";
	import MultiStepForm from "./multi-step-form.svelte";
	import type { MultiStepData } from "./schema.js";

	let { data }: { data: { form: SuperValidated<MultiStepData> } } = $props();
</script>

<h1>Conditional multi-step request</h1>
<p>One form owner, contact/details/review steps, and a complete native POST fallback.</p>
<MultiStepForm validated={data.form} restartHref={resolve("/recipes/multi-step")} />
