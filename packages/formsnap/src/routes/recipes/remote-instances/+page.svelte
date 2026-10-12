<script lang="ts">
	import { FieldErrors, Label, RemoteControl, RemoteField } from "@emmorts/formsnap/remote";
	import { onMount } from "svelte";
	import QuantityStepper from "./quantity-stepper.svelte";
	import { saveOrderLine } from "./save.remote.js";

	/**
	 * The lines this page can render, and the defaults it renders them with. This copy only decides
	 * what an edit form starts as; what a line accepts is the server's record.
	 */
	const LINES = [
		{ key: "line_a", label: "Espresso beans", defaultQuantity: 2 },
		{ key: "line_b", label: "Oat milk", defaultQuantity: 1 },
		{ key: "line_c", label: "Paper cups", defaultQuantity: 1 },
	] as const;

	/**
	 * Owning instances, created exactly once. `.for(key)` registers one refcounted instance per key,
	 * so creating them in a template expression or a derived would register another one on every
	 * re-evaluation. Creating them at component init also means a form that is removed and rendered
	 * again re-attaches to the instance it had, with the state it already held.
	 *
	 * The key used for presentation ids below is this list's own constant. A key that arrives from a
	 * client is only ever compared against the server's records; it is never rendered.
	 */
	/** What `.for(key)` returns, without importing a type SvelteKit does not export. */
	type OrderLineInstance = ReturnType<typeof saveOrderLine.for>;

	const lineForms: Record<string, OrderLineInstance> = Object.fromEntries(
		LINES.map((line) => [line.key, saveOrderLine.for(line.key)])
	);

	/** Which lines are on screen is this page's decision, and no instance is created or destroyed by it. */
	let hiddenLines = $state<string[]>([]);
	const visibleLines = $derived(LINES.filter((line) => !hiddenLines.includes(line.key)));

	/** The multiple-attachment mistake, rendered on request rather than by default. */
	let duplicateAttachment = $state(false);

	/**
	 * The reset policy, in one owner. The button stays a native reset control, so it works without
	 * JavaScript; with JavaScript this runs as well, because a widget that renders from the field
	 * state has to agree with the control that submits.
	 *
	 * Kit clears the issues and the touched and dirty state it tracks on the form's reset event, and
	 * its handler re-reads the form's values in a microtask. A browser restores a form's defaults a
	 * task later, so that read can capture the values from before the reset, and the field state then
	 * disagrees with the DOM until something writes it. Waiting for the DOM to settle and writing the
	 * rendered defaults back is that something.
	 */
	async function restoreRenderedDefaults(
		instance: OrderLineInstance | undefined,
		line: (typeof LINES)[number]
	) {
		if (!instance) return;
		await new Promise((resolve) => setTimeout(resolve, 0));
		instance.fields.set({ label: line.label, quantity: line.defaultQuantity, notes: "" });
	}

	function setRendered(key: string, rendered: boolean) {
		hiddenLines = rendered
			? hiddenLines.filter((hidden) => hidden !== key)
			: [...hiddenLines, key];
	}

	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<h1>Instances, custom controls and reset</h1>

<p>
	Each line below is its own <code>form.for(key)</code> instance: its own fields, its own issues, its
	own pending state and its own result. The key selects a record the server owns and enforces; it is
	client input, so it is never treated as a permission. Presentation ids are built from this page's
	own constants, which is what keeps them unique when the same logical paths repeat across instances.
</p>

<p>
	Removing a line only stops rendering its form: the instance was created once, so rendering it
	again shows the state it already had, and a submission that finishes while its form is off
	screen lands on that instance and nowhere else. Each line resets through a native reset control,
	which needs no JavaScript: the browser restores the rendered defaults, and the form's reset
	event makes Kit clear the issues and the touched and dirty state it tracks. Kit re-reads the
	form's values in a microtask while a browser restores those defaults a task later, so its state
	can keep the pre-reset values; the page therefore writes the rendered defaults back once the DOM
	has settled, which is what keeps the readout, the field state and the control that submits
	saying the same thing.
</p>

<div data-testid="instances-toolbar">
	{#each LINES as line (line.key)}
		<label for={`instances-render-${line.key}`}>Render {line.label}</label>
		<input
			id={`instances-render-${line.key}`}
			type="checkbox"
			checked={!hiddenLines.includes(line.key)}
			onchange={(event) => setRendered(line.key, event.currentTarget.checked)}
		/>
	{/each}
	{#each LINES.filter((line) => hiddenLines.includes(line.key)) as line (line.key)}
		{@const instance = lineForms[line.key]}
		<p data-testid={`order-${line.key}-hidden-status`}>
			{#if instance.pending > 0}
				Saving…
			{:else if instance.result?.outcome === "accepted"}
				Saved {instance.result.quantity} of {instance.result.label} on {instance.result.id}.
			{:else if instance.submitted}
				Submission finished without an accepted result.
			{:else}
				No submission yet.
			{/if}
		</p>
	{/each}
	<label for="instances-duplicate">Attach one instance to two forms (a mistake)</label>
	<input id="instances-duplicate" type="checkbox" bind:checked={duplicateAttachment} />
</div>

{#each visibleLines as line (line.key)}
	{@const instance = lineForms[line.key]}
	{@const labelField = instance.fields.label}
	{@const quantityField = instance.fields.quantity}
	{@const notesField = instance.fields.notes}
	{@const attachmentField = instance.fields.attachment}
	<!-- A file input needs the multipart enctype on the element that submits it natively. -->
	<form
		{...instance}
		enctype="multipart/form-data"
		data-testid={`order-line-${line.key}`}
		data-hydrated={hydrated}
		onreset={() => restoreRenderedDefaults(instance, line)}
	>
		<h2>{line.label}</h2>

		<small data-testid={`order-${line.key}-instance`}
			>Instance key <code>{line.key}</code></small
		>

		<RemoteField field={labelField} constraints={{ required: true }}>
			<RemoteControl id={`order-${line.key}-label`}>
				{#snippet children({ props })}
					<Label>Label</Label>
					<input
						data-testid={`order-${line.key}-label-input`}
						{...labelField.as("text", line.label)}
						{...props}
					/>
				{/snippet}
			</RemoteControl>
			{#snippet description()}
				<span>Rendered from the line's default, which is what a reset restores.</span>
			{/snippet}
			<FieldErrors />
		</RemoteField>

		<RemoteField field={quantityField}>
			<RemoteControl id={`order-${line.key}-quantity`}>
				{#snippet children({ props })}
					<Label>Quantity</Label>
					<input
						data-testid={`order-${line.key}-quantity-input`}
						{...quantityField.as("number", line.defaultQuantity)}
						{...props}
					/>
				{/snippet}
			</RemoteControl>
			<QuantityStepper
				inputId={`order-${line.key}-quantity`}
				default={line.defaultQuantity}
			/>
			{#snippet description()}
				<span>The stepper needs JavaScript; the number input does not.</span>
			{/snippet}
			<FieldErrors />
		</RemoteField>

		<RemoteField field={notesField}>
			<RemoteControl id={`order-${line.key}-notes`}>
				{#snippet children({ props })}
					<Label>Notes</Label>
					<input
						data-testid={`order-${line.key}-notes-input`}
						{...notesField.as("text")}
						{...props}
					/>
				{/snippet}
			</RemoteControl>
			<FieldErrors />
		</RemoteField>

		<RemoteField field={attachmentField}>
			<RemoteControl id={`order-${line.key}-attachment`}>
				{#snippet children({ props })}
					<Label>Attachment</Label>
					<input
						data-testid={`order-${line.key}-attachment-input`}
						{...attachmentField.as("file")}
						{...props}
					/>
				{/snippet}
			</RemoteControl>
			{#snippet description()}
				<span
					>At or under 64 kB, checked on the server. A rejected submission cannot put the
					file back, because a file input is the user's to fill.</span
				>
			{/snippet}
			<FieldErrors />
		</RemoteField>

		<button
			type="submit"
			disabled={instance.pending > 0}
			data-testid={`order-${line.key}-save`}
		>
			{#if instance.pending > 0}
				<span data-testid={`order-${line.key}-pending`}>Saving…</span>
			{:else}
				Save {line.label}
			{/if}
		</button>
		<button type="reset" data-testid={`order-${line.key}-reset`}>Reset {line.label}</button>

		<div aria-live="polite" data-testid={`order-${line.key}-outcome`}>
			{#if (instance.fields.allIssues() ?? []).length}
				<ul>
					{#each instance.fields.allIssues() ?? [] as issue (issue.message)}
						<li>{issue.message}</li>
					{/each}
				</ul>
			{/if}
			{#if instance.result?.outcome === "accepted"}
				<p data-testid={`order-${line.key}-message`}>
					Saved {instance.result.quantity} of {instance.result.label} on {instance.result
						.id}, attachment: {instance.result.attachment}.
				</p>
			{/if}
		</div>
	</form>
{/each}

{#if duplicateAttachment}
	<!-- The same instance on a second element. Kit refuses this instead of attaching twice and
	     submitting the form's data twice; the failure surfaces through the route's error boundary. -->
	<form {...lineForms.line_a} data-testid="instances-duplicate">
		<p>This element is a second attachment for the same instance.</p>
	</form>
{/if}
