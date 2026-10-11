<script lang="ts">
	import type { SuperValidated } from "sveltekit-superforms";
	import NativeForm from "./native-form.svelte";
	import CompositeForm from "./composite-form.svelte";
	import type { CompositeData, NativeData } from "./schema.js";

	let {
		data,
	}: {
		data: { native: SuperValidated<NativeData>; composite: SuperValidated<CompositeData> };
	} = $props();
</script>

<h1>Native and composite widgets</h1>
<p>
	Superforms owns values, validation, resets and submissions. Formsnap associates the rendered
	controls with their labels, descriptions and errors. Browser-native controls and the widget
	library own their interaction behavior; a hidden transport is not a second accessible control.
	These independent forms do not reinitialize each other after a successful enhanced submission
	because they explicitly use invalidateAll: false.
</p>
<NativeForm validated={data.native} />
<CompositeForm validated={data.composite} />
<p><a href="https://bits-ui.com/docs/components/select">Bits UI Select documentation</a></p>
