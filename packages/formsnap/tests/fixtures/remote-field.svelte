<script lang="ts">
	import {
		Description,
		FieldErrors,
		Label,
		Legend,
		RemoteControl,
		RemoteField,
		RemoteFieldset,
		type RemoteIssue,
	} from "$lib/remote/index.js";
	import RemoteHeadless from "./remote-headless.svelte";

	// Structural field stand-in; real Kit transport is exercised by the route tests.

	let handleIssues = $state<RemoteIssue[] | undefined>(undefined);
	let handleValue = $state("initial");
	let valueReads = 0;
	let handleTouched = $state(false);
	let handleDirty = $state(false);
	let siblingIssues = $state<RemoteIssue[] | undefined>(undefined);
	let handleConstraints = $state({ required: true, nested: { minlength: 3 } });
	let groupIssues = $state<RemoteIssue[] | undefined>(undefined);
	let descendantIssues = $state<RemoteIssue[]>([]);
	let headlessPrefix = $state<string | undefined>(undefined);
	let selectSibling = $state(false);
	let showContributors = $state(true);

	export function selectedValueReads() {
		return valueReads;
	}

	export function setHandle(next: {
		issues?: RemoteIssue[];
		value?: string;
		touched?: boolean;
		dirty?: boolean;
	}) {
		if (next.issues !== undefined) handleIssues = next.issues;
		if (next.value !== undefined) handleValue = next.value;
		if (next.touched !== undefined) handleTouched = next.touched;
		if (next.dirty !== undefined) handleDirty = next.dirty;
	}

	export function setSibling(issues: RemoteIssue[] | undefined) {
		siblingIssues = issues;
	}

	export function setGroup(issues: RemoteIssue[] | undefined) {
		groupIssues = issues;
	}

	export function setContributors(on: boolean) {
		showContributors = on;
	}

	export function setDescendant(issues: RemoteIssue[]) {
		descendantIssues = issues;
	}

	export function setHeadless(prefix: string | undefined) {
		headlessPrefix = prefix;
	}

	export function setSource(sibling: boolean) {
		selectSibling = sibling;
	}

	function fieldProps(
		name: string,
		type: string,
		issues: () => RemoteIssue[] | undefined,
		readValue: () => string
	) {
		return {
			name,
			type,
			get value() {
				return readValue();
			},
			get "aria-invalid"() {
				return issues()?.length ? "true" : undefined;
			},
		};
	}

	const handle = {
		value: () => {
			valueReads++;
			return handleValue;
		},
		touched: () => handleTouched,
		dirty: () => handleDirty,
		issues: () => handleIssues,
		as: (type: string) =>
			fieldProps(
				"opaque-handle-transport",
				type,
				() => handleIssues,
				() => handleValue
			),
	};

	const nickname = {
		value: () => "nick",
		touched: () => false,
		dirty: () => false,
		issues: () => siblingIssues,
		as: (type: string) =>
			fieldProps(
				"opaque-nickname-transport",
				type,
				() => siblingIssues,
				() => "nick"
			),
	};

	const links = {
		value: () => [],
		touched: () => false,
		dirty: () => false,
		issues: () => groupIssues,
		allIssues: () => [...(groupIssues ?? []), ...descendantIssues],
	};

	const selected = $derived(selectSibling ? nickname : handle);
</script>

<output data-backend-constraints>{JSON.stringify(handleConstraints)}</output>
<output data-backend-issues>{JSON.stringify(handleIssues)}</output>

<RemoteField field={selected} constraints={handleConstraints}>
	{#snippet children({ errors, issues, touched, dirty, constraints })}
		<output
			data-handle-snippet={JSON.stringify({
				errors,
				touched,
				dirty,
				required: constraints.required,
			})}
		></output>
		<button
			type="button"
			data-mutate-metadata
			onclick={() => {
				constraints.required = false;
				(constraints.nested as { minlength: number }).minlength = 999;
				if (issues?.[0]) {
					issues[0].message = "Changed by consumer";
					issues[0].path.push("changed");
				}
			}}>Mutate presentation metadata</button
		>
		{#if headlessPrefix}
			<RemoteHeadless prefix={headlessPrefix} />
		{/if}
		<RemoteControl>
			{#snippet children({ props })}
				<Label>Handle</Label>
				<input data-handle-control {...selected.as("text")} {...props} />
			{/snippet}
		</RemoteControl>
	{/snippet}
	{#snippet description()}
		<span data-handle-description>Three characters or more.</span>
	{/snippet}
	{#snippet fieldErrors({ errors })}
		<ol data-handle-errors>
			{#each errors as message, index (index)}
				<li>{message}</li>
			{/each}
		</ol>
	{/snippet}
</RemoteField>

<RemoteField field={nickname} constraints={handleConstraints}>
	<RemoteControl>
		{#snippet children({ props })}
			<Label>Nickname</Label>
			<input data-nickname-control {...nickname.as("text")} {...props} />
		{/snippet}
	</RemoteControl>
</RemoteField>

<RemoteFieldset field={links}>
	<Legend>Links</Legend>
	<output data-links-issues={JSON.stringify(groupIssues ?? [])}></output>
	<output data-links-summary>{JSON.stringify(links.allIssues())}</output>
	<RemoteControl>
		{#snippet children({ props })}
			<Label>First link</Label>
			<input data-links-control {...props} />
		{/snippet}
	</RemoteControl>
	{#if showContributors}
		<Description>One link per row.</Description>
		<FieldErrors />
	{/if}
</RemoteFieldset>
