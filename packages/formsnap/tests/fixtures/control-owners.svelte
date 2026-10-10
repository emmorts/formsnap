<script lang="ts">
	import { untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, Field, Label } from "$lib/index.js";
	import type { SettingsData } from "../../src/routes/schema.js";
	import ControlIdOwner from "./control-id-owner.svelte";

	let { validated }: { validated: SuperValidated<SettingsData> } = $props();
	const form = superForm(untrack(() => validated));
	let showFirst = $state(true);
	let showSecond = $state(true);
	let secondId = $state<string | null>("second-email");
	let firstId = $state("first-email");
	let componentId = $state("component-email");
</script>

<Field {form} name="email">
	<Control id={componentId}>
		{#snippet children({ props })}
			{#if showFirst}
				<ControlIdOwner owner="first" id={firstId} />
			{/if}
			{#if showSecond}
				<ControlIdOwner owner="second" id={secondId} />
			{/if}
			<Label>Email</Label>
			<input {...props} />
		{/snippet}
	</Control>
</Field>

<button type="button" onclick={() => (secondId = secondId ? null : "second-email")}>
	release second control id
</button>
<button type="button" onclick={() => (showFirst = !showFirst)}>toggle first control owner</button>
<button type="button" onclick={() => (showSecond = !showSecond)}>toggle second control owner</button
>
<button type="button" onclick={() => (firstId = "changed-first-email")}
	>change first control id</button
>
<button type="button" onclick={() => (componentId = "changed-component-email")}>
	change component control id
</button>
