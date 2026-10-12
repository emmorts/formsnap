<script lang="ts">
	import {
		Description,
		FieldErrors,
		Label,
		Legend,
		RemoteControl,
		RemoteField,
		RemoteFieldset,
	} from "@emmorts/formsnap/remote";
	import { saveRemote } from "../save.remote.js";

	// Read each selected field once: a Kit accessor may hand back a fresh proxy per read, so nothing
	// here keys on the object's identity.
	const handle = saveRemote.fields.handle;
	const seats = saveRemote.fields.seats;
	const notifications = saveRemote.fields.notifications;
	const password = saveRemote.fields._password;
	const links = saveRemote.fields.links;
</script>

<h1>Remote form, presented by Formsnap</h1>

<p>
	The same native SvelteKit remote form as the baseline page, presented with the remote entry
	point. Kit keeps the transport names and sends the values; Formsnap adds IDs, label and
	description associations, error containers and its data attributes, and never a second <code
		>name</code
	>.
</p>

<form {...saveRemote} data-testid="formsnap-remote-form">
	<RemoteField field={handle} constraints={{ required: true }}>
		<RemoteControl>
			{#snippet children({ props })}
				<Label>Handle</Label>
				<input data-testid="fs-handle" {...handle.as("text")} {...props} />
			{/snippet}
		</RemoteControl>
		{#snippet description()}
			<span>Three characters or more.</span>
		{/snippet}
		{#snippet fieldErrors({ errors })}
			<ol data-testid="fs-handle-errors">
				{#each errors as message, index (index)}
					<li>{message}</li>
				{/each}
			</ol>
		{/snippet}
	</RemoteField>

	<RemoteField field={seats}>
		<RemoteControl>
			{#snippet children({ props })}
				<Label>Seats</Label>
				<input data-testid="fs-seats" {...seats.as("number")} {...props} />
			{/snippet}
		</RemoteControl>
	</RemoteField>

	<RemoteField field={notifications}>
		<RemoteControl>
			{#snippet children({ props })}
				<Label>Notifications</Label>
				<input
					data-testid="fs-notifications"
					{...notifications.as("checkbox")}
					{...props}
				/>
			{/snippet}
		</RemoteControl>
	</RemoteField>

	<RemoteField field={password}>
		<RemoteControl>
			{#snippet children({ props })}
				<Label>Password</Label>
				<input data-testid="fs-password" {...password.as("password")} {...props} />
			{/snippet}
		</RemoteControl>
	</RemoteField>

	<RemoteFieldset field={links}>
		<Legend>Links</Legend>
		<output data-testid="fs-link-issues">
			{JSON.stringify(links.allIssues() ?? [])}
		</output>
		<Description>The first link only, for this baseline.</Description>
		<FieldErrors />
	</RemoteFieldset>

	<button>Save</button>
</form>

{#if saveRemote.result}
	<output data-testid="fs-remote-result">{JSON.stringify(saveRemote.result)}</output>
{/if}
