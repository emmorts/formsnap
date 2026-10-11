<script lang="ts">
	import { untrack } from "svelte";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { Control, Field, Label } from "$lib/index.js";
	import type { ReactivityData } from "../../../tests/fixtures/reactivity-schema.js";
	import LabelWidget from "./label-widget.svelte";

	let {
		validated,
		headless = false,
	}: { validated: SuperValidated<ReactivityData>; headless?: boolean } = $props();
	const form = superForm(
		untrack(() => validated),
		{ dataType: "json" }
	);
	let showFirst = $state(true);
	let showSecond = $state(true);
	let showChild = $state(false);
	let spreadChild = $state(true);
	let firstId = $state("first-label");
	let secondId = $state("second-label");
	let controlId = $state("identity-control");
	let firstRef = $state<HTMLElement | null>(null);
	let secondRef = $state<HTMLElement | null>(null);
	let childRef = $state<HTMLElement | null>(null);

	export function stores() {
		return form;
	}

	export function refs() {
		return { first: firstRef, second: secondRef, child: childRef };
	}
</script>

<Field {form} name="profile.name">
	<Control id={controlId}>
		{#snippet children({ props })}
			{#if showFirst}
				<Label id={firstId} bind:ref={firstRef}>First label</Label>
			{/if}
			{#if showSecond}
				<Label id={secondId} bind:ref={secondRef}>Second label</Label>
			{/if}
			{#if showChild}
				<Label id="child-label" bind:ref={childRef}>
					{#snippet child({ props: labelProps })}
						{#if spreadChild}
							<span {...labelProps} data-custom-label>Child label</span>
						{:else}
							<span data-custom-label>No label props</span>
						{/if}
					{/snippet}
				</Label>
			{/if}
			{#if headless}
				<LabelWidget fallback={!showFirst && !showSecond && (!showChild || !spreadChild)} />
			{:else}
				<input {...props} data-native-control />
			{/if}
		{/snippet}
	</Control>
</Field>

<output
	data-label-refs
	data-first-ref={firstRef?.id ?? ""}
	data-second-ref={secondRef?.id ?? ""}
	data-child-ref={childRef?.id ?? ""}
></output>
<button type="button" onclick={() => (showFirst = !showFirst)}>Toggle first label</button>
<button type="button" onclick={() => (showSecond = !showSecond)}>Toggle second label</button>
<button type="button" onclick={() => (showChild = !showChild)}>Toggle child label</button>
<button type="button" onclick={() => (spreadChild = !spreadChild)}>Toggle child spread</button>
<button type="button" onclick={() => (firstId = "changed-first-label")}
	>Change first label id</button
>
<button type="button" onclick={() => (secondId = "changed-second-label")}
	>Change second label id</button
>
<button type="button" onclick={() => (controlId = "changed-identity-control")}
	>Change control id</button
>
