<script lang="ts">
	import { superForm } from "sveltekit-superforms";
	import { Field } from "$lib/index.js";
	import { RemoteControl } from "$lib/remote/index.js";

	const form = superForm({ handle: "Ada" });
</script>

<Field {form} name="handle">
	<RemoteControl>
		{#snippet children({ props })}<input {...props} />{/snippet}
	</RemoteControl>
</Field>
