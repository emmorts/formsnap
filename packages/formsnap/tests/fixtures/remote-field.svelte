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

	/**
	 * Stands in for a Kit remote field: presentation reads only `value()`, `touched()`, `dirty()` and
	 * `issues()`, so the structural contract can be exercised without a remote-form runtime. `as()`
	 * mimics the props Kit returns, including that Kit owns `name` and `aria-invalid`.
	 */

	let handleIssues = $state<RemoteIssue[] | undefined>(undefined);
	let handleValue = $state("initial");
	let handleTouched = $state(false);
	let handleDirty = $state(false);
	let siblingIssues = $state<RemoteIssue[] | undefined>(undefined);
	let groupIssues = $state<RemoteIssue[] | undefined>(undefined);
	/** Whether the group's standalone description and error container are mounted at all. */
	let showContributors = $state(true);

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

	/** Mount or unmount the group's standalone contributors, which own their registrations. */
	export function setContributors(on: boolean) {
		showContributors = on;
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
		value: () => handleValue,
		touched: () => handleTouched,
		dirty: () => handleDirty,
		issues: () => handleIssues,
		as: (type: string) =>
			fieldProps(
				"handle/1cuw750/saveRemote",
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
				"nickname/1cuw750/saveRemote",
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
		allIssues: () => groupIssues,
	};
</script>

<RemoteField field={handle} constraints={{ required: true }}>
	{#snippet children({ errors, touched, dirty, constraints })}
		<output
			data-handle-snippet={JSON.stringify({
				errors,
				touched,
				dirty,
				required: constraints.required,
			})}
		></output>
		<RemoteControl>
			{#snippet children({ props })}
				<Label>Handle</Label>
				<input data-handle-control {...handle.as("text")} {...props} />
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

<RemoteField field={nickname}>
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
