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
	import { saveRemoteOrder } from "./save.remote.js";

	// Read each selected field once: a Kit accessor may hand back a fresh proxy per read, so nothing
	// here keys on the object's identity.
	const title = saveRemoteOrder.fields.title;
	const seats = saveRemoteOrder.fields.seats;
	const notifications = saveRemoteOrder.fields.notifications;
	const channels = saveRemoteOrder.fields.channels;
	const delivery = saveRemoteOrder.fields.delivery;
	const method = delivery.method;
	const postcode = delivery.postcode;
	const password = saveRemoteOrder.fields._password;

	/**
	 * Kit's own enhancement resets the form whenever a submission comes back without issues. A
	 * refused domain result carries no issues, so the default would clear the typed values and read
	 * as a success. This recipe replaces that single decision through the form's own `enhance`: it
	 * resets and confirms only for the accepted outcome, and never on the existence of a result.
	 */
	const enhanced = saveRemoteOrder.enhance(async ({ submit, element }) => {
		const acceptedByServer = await submit();
		if (acceptedByServer && saveRemoteOrder.result?.outcome === "accepted") {
			// Reset to the rendered defaults, which is what a native reset restores. The call goes
			// through the prototype for the same reason Kit's own default does.
			HTMLFormElement.prototype.reset.call(element);
		}
	});

	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
</script>

<h1>Native remote form, end to end</h1>

<p>
	One native SvelteKit remote form, presented by Formsnap: an edit default, a number, a boolean, a
	choice group, a nested group constraint, and both a rejection the handler decides and a result
	that reports a domain refusal. Kit owns the transport names, the values and the submission;
	Formsnap owns labels, descriptions, error containers and ids.
</p>

<p>
	The page keys the confirmation and the reset on the result's <code>outcome</code>. Kit resets a
	submission that returns no issues, and a refused result has none, so a truthy result is not a
	success signal here. Without JavaScript the server echoes input only alongside issues: a
	rejection restores the typed values, while an accepted or refused result renders the form's
	defaults again.
</p>

<form {...enhanced} data-testid="recipe-remote" data-hydrated={hydrated}>
	<!-- Root issues have no path, so they belong to the form rather than to a control. One region
	     holds them and the domain outcome, so a submission has a single place to be reported. -->
	<div data-testid="remote-recipe-outcome" aria-live="polite" aria-atomic="true">
		{#if (saveRemoteOrder.fields.issues() ?? []).length}
			<ul data-testid="remote-recipe-root-issues">
				{#each saveRemoteOrder.fields.issues() ?? [] as issue (issue.message)}
					<li>{issue.message}</li>
				{/each}
			</ul>
		{/if}
		{#if saveRemoteOrder.result?.outcome === "accepted"}
			<p data-testid="remote-recipe-message">
				Saved {saveRemoteOrder.result.title} for {saveRemoteOrder.result.seats} seats, delivery
				by
				{saveRemoteOrder.result.delivery}, channels {saveRemoteOrder.result.channels}.
			</p>
		{:else if saveRemoteOrder.result?.outcome === "unavailable"}
			<p data-testid="remote-recipe-refusal">
				{saveRemoteOrder.result.reason} Change the delivery method or the postcode and send it
				again.
			</p>
		{/if}
	</div>

	<RemoteField field={title} constraints={{ required: true }}>
		<RemoteControl id="remote-recipe-title">
			{#snippet children({ props })}
				<Label>Order title</Label>
				<input
					data-testid="remote-recipe-title-input"
					{...title.as("text", "Monthly digest")}
					{...props}
				/>
			{/snippet}
		</RemoteControl>
		{#snippet description()}
			<span>Three to forty characters. "reserved" is refused by the handler.</span>
		{/snippet}
		<FieldErrors />
	</RemoteField>

	<RemoteField field={seats}>
		<RemoteControl id="remote-recipe-seats">
			{#snippet children({ props })}
				<Label>Seats</Label>
				<input
					data-testid="remote-recipe-seats-input"
					{...seats.as("number", 3)}
					{...props}
				/>
			{/snippet}
		</RemoteControl>
		{#snippet description()}
			<span>One to ten seats.</span>
		{/snippet}
		<FieldErrors />
	</RemoteField>

	<RemoteField field={notifications}>
		<RemoteControl id="remote-recipe-notifications">
			{#snippet children({ props })}
				<input
					data-testid="remote-recipe-notifications-input"
					{...notifications.as("checkbox", true)}
					{...props}
				/>
				<Label>Send a notification when the order changes</Label>
			{/snippet}
		</RemoteControl>
		<FieldErrors />
	</RemoteField>

	<!-- A choice group rendered as a fieldset: one control per option, so each gets its own Formsnap
	     control id while all of them carry the one transport name Kit generates for the field. -->
	<RemoteFieldset field={channels} id="remote-recipe-channels">
		<Legend>Channels</Legend>
		{#snippet description()}
			<span
				>A group needs at least one channel. This group is required without a native
				attribute.</span
			>
		{/snippet}
		<RemoteControl id="remote-recipe-channel-email">
			{#snippet children({ props })}
				<input
					data-testid="remote-recipe-channel-email"
					{...channels.as("checkbox", "email", true)}
					{...props}
				/>
				<Label>Email</Label>
			{/snippet}
		</RemoteControl>
		<RemoteControl id="remote-recipe-channel-sms">
			{#snippet children({ props })}
				<input
					data-testid="remote-recipe-channel-sms"
					{...channels.as("checkbox", "sms")}
					{...props}
				/>
				<Label>SMS</Label>
			{/snippet}
		</RemoteControl>
		<RemoteControl id="remote-recipe-channel-push">
			{#snippet children({ props })}
				<input
					data-testid="remote-recipe-channel-push"
					{...channels.as("checkbox", "push", true)}
					{...props}
				/>
				<Label>Push</Label>
			{/snippet}
		</RemoteControl>
		<FieldErrors />
	</RemoteFieldset>

	<!-- A nested group: Formsnap renders the group as a fieldset, and the group's constraint is
	     reported on the member that has to change. -->
	<RemoteFieldset field={delivery} id="remote-recipe-delivery">
		<Legend>Delivery</Legend>
		{#snippet description()}
			<span>A courier needs a four-digit postcode.</span>
		{/snippet}
		<RemoteField field={method}>
			<RemoteControl id="remote-recipe-method">
				{#snippet children({ props })}
					<Label>Method</Label>
					<select
						data-testid="remote-recipe-method-select"
						{...method.as("select", "pickup")}
						{...props}
					>
						<option value="pickup">Pickup</option>
						<option value="courier">Courier</option>
					</select>
				{/snippet}
			</RemoteControl>
			<FieldErrors />
		</RemoteField>
		<RemoteField field={postcode}>
			<RemoteControl id="remote-recipe-postcode">
				{#snippet children({ props })}
					<Label>Postcode</Label>
					<input
						data-testid="remote-recipe-postcode-input"
						{...postcode.as("text")}
						{...props}
					/>
				{/snippet}
			</RemoteControl>
			<FieldErrors />
		</RemoteField>
		<FieldErrors />
	</RemoteFieldset>

	<RemoteField field={password}>
		<RemoteControl id="remote-recipe-password">
			{#snippet children({ props })}
				<Label>Account password</Label>
				<input
					data-testid="remote-recipe-password-input"
					{...password.as("password")}
					{...props}
				/>
			{/snippet}
		</RemoteControl>
		{#snippet description()}
			<span
				>The handler authorises the change with it. A rejected submission never echoes it
				back, so it has to be typed again.</span
			>
		{/snippet}
		<FieldErrors />
	</RemoteField>

	<button type="submit" disabled={saveRemoteOrder.pending > 0}>
		{#if saveRemoteOrder.pending > 0}
			<span data-testid="remote-recipe-pending">Saving…</span>
		{:else}
			Save order
		{/if}
	</button>
</form>
