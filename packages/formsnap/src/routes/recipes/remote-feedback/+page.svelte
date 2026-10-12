<script lang="ts">
	import {
		Label,
		Legend,
		RemoteControl,
		RemoteField,
		RemoteFieldset,
	} from "@emmorts/formsnap/remote";
	import { onMount, tick } from "svelte";
	import { feedbackPreflightSchema } from "./schema.js";
	import { saveRemoteFeedback } from "./save.remote.js";

	// Read each selected field once: a Kit accessor may hand back a fresh proxy per read.
	const handle = saveRemoteFeedback.fields.handle;
	const seats = saveRemoteFeedback.fields.seats;
	const channels = saveRemoteFeedback.fields.channels;
	const notes = saveRemoteFeedback.fields.notes;
	const password = saveRemoteFeedback.fields._password;

	/**
	 * The client-side pass Kit runs before the request. It is a no-op on the server, and it is not the
	 * schema: it checks the rules worth blocking a round trip on, so a submission that passes it can
	 * still be rejected by the server. A failure here returns before the enhancement callback below
	 * runs, which is why nothing on this page renders feedback from inside that callback.
	 */
	saveRemoteFeedback.preflight(feedbackPreflightSchema);

	/**
	 * Kit's default enhancement resets a submission that returns no issues, and a refused domain
	 * result has none. This callback replaces only that decision, so a refusal keeps the values while
	 * an accepted outcome resets. It moves no focus: the summary links are the only thing on this page
	 * that does, and Kit never focuses a remote form by itself.
	 */
	const enhanced = saveRemoteFeedback.enhance(async ({ submit, element }) => {
		const acceptedByServer = await submit();
		if (acceptedByServer && saveRemoteFeedback.result?.outcome === "accepted") {
			HTMLFormElement.prototype.reset.call(element);
		}
	});

	/** The conditional notes field, the toggle that removes it, and the disclosure it lives in. */
	let notesOpen = $state(true);
	let notesExpanded = $state(false);
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});

	// The elements this page rendered, known in the browser only. They are what moves focus; they are
	// not what decides whether an entry is a link.
	let handleInput = $state<HTMLInputElement>();
	let seatsInput = $state<HTMLInputElement>();
	let channelInput = $state<HTMLInputElement>();
	let notesInput = $state<HTMLInputElement>();
	let passwordInput = $state<HTMLInputElement>();

	const labels: Record<string, string> = {
		handle: "Handle",
		seats: "Seats",
		channels: "Channels",
		notes: "Notes",
		_password: "Account password",
	};

	/** A readable name for an issue's path, with the form's own name for a path-less issue. */
	function labelFor(path: Array<string | number>) {
		const [head] = path;
		return head === undefined ? "Order" : (labels[String(head)] ?? "Order");
	}

	/**
	 * Application-owned targets: the id is declared here, so a server-rendered page can link to a
	 * control without JavaScript, and the element is used only to move focus. The one conditional
	 * target exists exactly while the page renders its control, and a group's issues point at the
	 * control a user starts from rather than at a fabricated group id.
	 */
	function targetFor(path: Array<string | number>) {
		const [head] = path;
		if (head === "handle") return { id: "feedback-handle", element: handleInput };
		if (head === "seats") return { id: "feedback-seats", element: seatsInput };
		if (head === "channels") return { id: "feedback-channel-email", element: channelInput };
		if (head === "notes") {
			return notesOpen ? { id: "feedback-notes", element: notesInput } : undefined;
		}
		if (head === "_password") return { id: "feedback-password", element: passwordInput };
		// A root issue has no path, so no control owns it and its entry is not a link.
		return undefined;
	}

	/**
	 * The single owner of focus movement on this page. An ordinary rejection moves nothing: the
	 * summary is a place the user chooses to go. A collapsed target is revealed before it is focused,
	 * and the mapping is read again after the tick so a removed field cannot leave a stale reference.
	 */
	async function activateTarget(event: MouseEvent, path: Array<string | number>) {
		if (!targetFor(path)) return;
		event.preventDefault();
		if (path[0] === "notes") {
			notesOpen = true;
			notesExpanded = true;
		}
		await tick();
		targetFor(path)?.element?.focus();
	}
</script>

<h1>Rejection layers and one feedback policy</h1>

<p>
	The same native remote form is rejected in six different places, and all six read the same way:
	one form-wide announcement region, plus inline error containers that the field scopes declare
	and that carry <code>aria-live="off"</code>, so a message is never announced twice. Nothing is
	announced from an enhancement callback, because a preflight failure never reaches one.
</p>

<ul>
	<li>
		<strong>Browser constraint</strong>: the handle carries a native <code>required</code>, a
		<code>pattern</code> and a length range, so the browser refuses to submit at all and no request
		is made.
	</li>
	<li>
		<strong>Client preflight</strong>: <code>saveRemoteFeedback.preflight(...)</code> checks the handle,
		the seat count and the channel group before the request, so the server never sees an obviously
		invalid submission.
	</li>
	<li>
		<strong>Server schema</strong>: the notes field is left out of the preflight pass, so only
		the server's schema rejects an over-long note. It is an input rule, not a lookup: no schema
		here touches stored data.
	</li>
	<li>
		<strong>Server imperative</strong>: the handler adds issues itself, both on a field path
		and, for the password check, with no path at all.
	</li>
	<li>
		<strong>Domain failure</strong>: <code>weekly</code> only has four seats left, so five seats is
		a refused result rather than an error the user can fix in the form.
	</li>
	<li>
		<strong>Unexpected failure</strong>: the handle <code>explode</code> makes the handler throw.
		That is not a validation outcome, so it surfaces through the route's error boundary, and what
		the browser is told is SvelteKit's sanitized message rather than the handler's own text.
	</li>
</ul>

<p>
	Without JavaScript the browser's own constraint check and the server's schema are what reject a
	submission: the preflight pass does not run, and the summary's links still resolve because their
	targets are declared ids rather than elements the browser had to find. Focus stays where the
	user left it in every case, and an entry is a link only while its target is rendered.
</p>

<label for="feedback-notes-toggle">Record order notes</label>
<input id="feedback-notes-toggle" type="checkbox" bind:checked={notesOpen} />

<form {...enhanced} data-testid="recipe-remote-feedback" data-hydrated={hydrated}>
	<!-- One live region for the whole form. It holds the summary of every issue and the outcome, so a
	     rejection is announced once, from one place. -->
	<div aria-live="polite" aria-atomic="true" data-testid="feedback-announcement">
		{#if (saveRemoteFeedback.fields.allIssues() ?? []).length}
			<section aria-labelledby="feedback-summary-title" data-testid="feedback-summary">
				<h2 id="feedback-summary-title">Check the order</h2>
				<ul>
					{#each saveRemoteFeedback.fields.allIssues() ?? [] as issue (`${issue.path.join(".")}:${issue.message}`)}
						{@const target = targetFor(issue.path)}
						<li>
							{#if target}
								<a
									href={`#${target.id}`}
									onclick={(event) => activateTarget(event, issue.path)}
									data-testid={`feedback-summary-${issue.path.join("-") || "root"}`}
									>{labelFor(issue.path)}: {issue.message}</a
								>
							{:else}
								<span
									data-testid={`feedback-summary-${issue.path.join("-") || "root"}`}
									>{labelFor(issue.path)}: {issue.message}</span
								>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{:else if saveRemoteFeedback.result?.outcome === "accepted"}
			<p data-testid="feedback-accepted">
				Saved {saveRemoteFeedback.result.handle} for {saveRemoteFeedback.result.seats} seats.
			</p>
		{:else if saveRemoteFeedback.result?.outcome === "declined"}
			<p data-testid="feedback-declined">{saveRemoteFeedback.result.reason}</p>
		{/if}
	</div>

	<!-- The native constraint layer. Formsnap never emits a native `required`, so this one is the
	     page's own decision, and the form deliberately does not opt out of constraint validation. -->
	<RemoteField field={handle} constraints={{ required: true }} fieldErrors fieldErrorsLive="off">
		<RemoteControl id="feedback-handle">
			{#snippet children({ props })}
				<Label>Handle</Label>
				<input
					data-testid="feedback-handle-input"
					required
					minlength="3"
					maxlength="12"
					pattern="[a-z0-9_]+"
					{...handle.as("text")}
					{...props}
					bind:this={handleInput}
				/>
			{/snippet}
		</RemoteControl>
		{#snippet description()}
			<span
				>Lower-case letters, digits and underscores. "reserved" and "explode" are the
				handler's own decisions.</span
			>
		{/snippet}
	</RemoteField>

	<RemoteField field={seats} fieldErrors fieldErrorsLive="off">
		<RemoteControl id="feedback-seats">
			{#snippet children({ props })}
				<Label>Seats</Label>
				<input
					data-testid="feedback-seats-input"
					{...seats.as("number")}
					{...props}
					bind:this={seatsInput}
				/>
			{/snippet}
		</RemoteControl>
		{#snippet description()}
			<span>One to ten seats. "weekly" has four left, which the handler declines.</span>
		{/snippet}
	</RemoteField>

	<RemoteFieldset field={channels} id="feedback-channels" fieldErrors fieldErrorsLive="off">
		<Legend>Channels</Legend>
		{#snippet description()}
			<span>At least one channel.</span>
		{/snippet}
		<RemoteControl id="feedback-channel-email">
			{#snippet children({ props })}
				<input
					data-testid="feedback-channel-email"
					{...channels.as("checkbox", "email")}
					{...props}
					bind:this={channelInput}
				/>
				<Label>Email</Label>
			{/snippet}
		</RemoteControl>
		<RemoteControl id="feedback-channel-sms">
			{#snippet children({ props })}
				<input
					data-testid="feedback-channel-sms"
					{...channels.as("checkbox", "sms")}
					{...props}
				/>
				<Label>SMS</Label>
			{/snippet}
		</RemoteControl>
	</RemoteFieldset>

	<!-- A conditional field, collapsed by default. Removing it takes its target with it, so a note
	     error stays readable without a link, and activating that entry has to reveal the disclosure
	     before it can focus the control inside it. -->
	{#if notesOpen}
		<details bind:open={notesExpanded} data-testid="feedback-notes-disclosure">
			<summary>Order notes</summary>
			<RemoteField field={notes} fieldErrors fieldErrorsLive="off">
				<RemoteControl id="feedback-notes">
					{#snippet children({ props })}
						<Label>Notes</Label>
						<input
							data-testid="feedback-notes-input"
							{...notes.as("text")}
							{...props}
							bind:this={notesInput}
						/>
					{/snippet}
				</RemoteControl>
				{#snippet description()}
					<span>Twenty characters. The preflight pass does not check this field.</span>
				{/snippet}
			</RemoteField>
		</details>
	{/if}

	<RemoteField field={password} fieldErrors fieldErrorsLive="off">
		<RemoteControl id="feedback-password">
			{#snippet children({ props })}
				<Label>Account password</Label>
				<input
					data-testid="feedback-password-input"
					{...password.as("password")}
					{...props}
					bind:this={passwordInput}
				/>
			{/snippet}
		</RemoteControl>
		{#snippet description()}
			<span>The handler authorises the change with it. "formsnap" is the accepted value.</span
			>
		{/snippet}
	</RemoteField>

	<button type="submit" disabled={saveRemoteFeedback.pending > 0}>
		{#if saveRemoteFeedback.pending > 0}
			<span data-testid="feedback-pending">Saving…</span>
		{:else}
			Save order
		{/if}
	</button>
</form>
