<script lang="ts">
	import { onMount } from "svelte";
	import LabelIdentity from "./label-identity.svelte";
	import type { PageData } from "./$types.js";

	let { data }: { data: PageData } = $props();
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<main data-label-fixture data-hydrated={String(hydrated)}>
	<LabelIdentity validated={data.form} headless={data.headless} />
</main>
