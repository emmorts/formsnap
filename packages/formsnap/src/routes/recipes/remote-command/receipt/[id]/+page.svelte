<script lang="ts">
	import { resolve } from "$app/paths";
	import type { PlacedOrder } from "../../orders.js";

	let { data }: { data: { order: PlacedOrder } } = $props();
</script>

<h1>Receipt</h1>

<p data-testid="receipt-summary">
	{data.order.id}: {data.order.seats} seats on the {data.order.plan} plan.
</p>

{#if data.order.note}
	<p>Note: {data.order.note}</p>
{/if}

<a href={resolve("/recipes/remote-command")} data-testid="receipt-back">Back to the form</a>
