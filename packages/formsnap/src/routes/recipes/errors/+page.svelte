<script lang="ts">
	import type { SuperValidated } from "sveltekit-superforms";
	import BookingForm from "./booking-form.svelte";
	import type { ErrorsData } from "./schema.js";

	let {
		data,
	}: {
		data: { personal: SuperValidated<ErrorsData>; work: SuperValidated<ErrorsData> };
	} = $props();
</script>

<h1>Form-wide errors and linked summaries</h1>
<p>
	Each booking has its own summary. Date ordering is a form-wide error, not an error assigned to
	one date. Contact errors keep their readable label even when the optional section is removed.
</p>
<BookingForm validated={data.personal} scope="personal" title="Personal booking" />
<BookingForm validated={data.work} scope="work" title="Work booking" />
