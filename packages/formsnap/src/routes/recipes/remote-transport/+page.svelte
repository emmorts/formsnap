<script lang="ts">
	import {
		FieldErrors,
		Label,
		Legend,
		RemoteControl,
		RemoteField,
		RemoteFieldset,
	} from "@emmorts/formsnap/remote";
	import { onMount } from "svelte";
	import { transportPreflightSchema } from "./schema.js";
	import { saveTransport } from "./save.remote.js";

	/**
	 * What the server actually receives, and what it never receives.
	 *
	 * Every field here is spread from Kit's own props, so the transport name is Kit's and not this
	 * page's. The two submit buttons carry the name of one field, `decision`, so the activated
	 * submitter sets it: the handler can tell which button was pressed without a second field.
	 *
	 * The client pass blocks a seat count below one, and the handler returns how many times it has run,
	 * so a submission stopped by the pass is proved not to have reached the server. The pass does not
	 * check the group or the file limit, so those stay the server's decisions.
	 */
	const decision = saveTransport.fields.decision;
	const seats = saveTransport.fields.seats;
	const subscribe = saveTransport.fields.subscribe;
	const channels = saveTransport.fields.channels;
	const attachment = saveTransport.fields.attachment;

	saveTransport.preflight(transportPreflightSchema);

	/** The seats the page renders, which is what a reset restores. */
	const RENDERED_SEATS = 2;

	/**
	 * The measured reset policy, the same one the instance recipe uses: Kit clears the issues and the
	 * touched and dirty state it tracks on the form's reset event, and it re-reads the form's values in
	 * a microtask, while the browser restores the form's defaults a task later. That read therefore
	 * captures the pre-reset values. Waiting for the DOM to settle and writing the rendered seats back
	 * is what keeps the control and the field read saying the same thing.
	 *
	 * Only the seats field is written back, so the other fields keep Kit's own reset contract: their
	 * touched and dirty state is cleared by Kit and nothing writes it again.
	 */
	async function restoreRenderedDefaults() {
		await new Promise((resolve) => setTimeout(resolve, 0));
		seats.set(RENDERED_SEATS);
	}

	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<h1>What the server receives</h1>

<p>
	One native remote form whose handler reports exactly what arrived: a number, a boolean, a choice
	group, a file, and the value of whichever submit button was pressed. Both submit buttons name
	the same field, so Kit folds the activated one into the payload and the handler reads it as a
	value like any other.
</p>

<p>
	The client pass checks the seat count before the request. The handler counts its own runs and
	returns that count, so a submission the pass stopped is visible as a count that did not move,
	which is a server result rather than a claim about the client.
</p>

<!-- A file control needs the multipart enctype on the element that submits it. -->
<form
	{...saveTransport}
	enctype="multipart/form-data"
	data-testid="recipe-remote-transport"
	data-hydrated={hydrated}
	onreset={restoreRenderedDefaults}
>
	<div aria-live="polite" aria-atomic="true">
		{#if saveTransport.result?.outcome === "accepted"}
			{@const result = saveTransport.result}
			<p
				data-testid="transport-result"
				data-decision={result.decision}
				data-seats={String(result.seats)}
				data-subscribe={String(result.subscribe)}
				data-channels={result.channels}
				data-attachment={result.attachment}
				data-attempts={String(result.attempts)}
			>
				Received {result.decision}: {result.seats} seats, digest {result.subscribe
					? "on"
					: "off"}, channels {result.channels}, attachment {result.attachment}.
			</p>
		{/if}
	</div>

	<RemoteField field={seats}>
		{#snippet children({ touched, dirty })}
			<output
				data-testid="transport-seats-state"
				data-touched={String(touched)}
				data-dirty={String(dirty)}
				data-value={String(seats.value() ?? RENDERED_SEATS)}
			></output>
			<RemoteControl id="transport-seats">
				{#snippet children({ props })}
					<Label>Seats</Label>
					<input
						data-testid="transport-seats-input"
						{...seats.as("number", RENDERED_SEATS)}
						{...props}
					/>
				{/snippet}
			</RemoteControl>
			<FieldErrors />
		{/snippet}
		{#snippet description()}
			<span>One to nine seats. The client pass blocks fewer than one.</span>
		{/snippet}
	</RemoteField>

	<RemoteField field={subscribe}>
		{#snippet children({ touched, dirty })}
			<output
				data-testid="transport-subscribe-state"
				data-touched={String(touched)}
				data-dirty={String(dirty)}
			></output>
			<RemoteControl id="transport-subscribe">
				{#snippet children({ props })}
					<input
						data-testid="transport-subscribe-input"
						{...subscribe.as("checkbox", true)}
						{...props}
					/>
					<Label>Send me the digest</Label>
				{/snippet}
			</RemoteControl>
			<FieldErrors />
		{/snippet}
	</RemoteField>

	<!-- A primitive array leaf: one control per option, all carrying the one transport name Kit
	     generates for the field. -->
	<RemoteFieldset field={channels} id="transport-channels">
		<Legend>Channels</Legend>
		{#snippet description()}
			<span>At least one channel. The group rule is the server's, not the client pass's.</span
			>
		{/snippet}
		<RemoteControl id="transport-channel-email">
			{#snippet children({ props })}
				<input
					data-testid="transport-channel-email"
					{...channels.as("checkbox", "email", true)}
					{...props}
				/>
				<Label>Email</Label>
			{/snippet}
		</RemoteControl>
		<RemoteControl id="transport-channel-sms">
			{#snippet children({ props })}
				<input
					data-testid="transport-channel-sms"
					{...channels.as("checkbox", "sms")}
					{...props}
				/>
				<Label>SMS</Label>
			{/snippet}
		</RemoteControl>
		<RemoteControl id="transport-channel-push">
			{#snippet children({ props })}
				<input
					data-testid="transport-channel-push"
					{...channels.as("checkbox", "push", true)}
					{...props}
				/>
				<Label>Push</Label>
			{/snippet}
		</RemoteControl>
		<FieldErrors />
	</RemoteFieldset>

	<RemoteField field={attachment}>
		<RemoteControl id="transport-attachment">
			{#snippet children({ props })}
				<Label>Attachment</Label>
				<input
					data-testid="transport-attachment-input"
					{...attachment.as("file")}
					{...props}
				/>
			{/snippet}
		</RemoteControl>
		{#snippet description()}
			<span>At or under 64 kB, checked on the server rather than in the picker.</span>
		{/snippet}
		<FieldErrors />
	</RemoteField>

	<!-- Both buttons name the same field. Kit builds the transport name and the submit type, so nothing
	     here writes an encoded name by hand. -->
	<button
		disabled={saveTransport.pending > 0}
		data-testid="transport-submit-save"
		{...decision.as("submit", "save")}>Save</button
	>
	<button
		disabled={saveTransport.pending > 0}
		data-testid="transport-submit-publish"
		{...decision.as("submit", "publish")}>Save and publish</button
	>
	<button type="reset" data-testid="transport-reset">Reset</button>
</form>
