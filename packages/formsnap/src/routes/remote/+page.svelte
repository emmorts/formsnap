<script lang="ts">
	import { saveRemote } from "./save.remote.js";
</script>

<h1>Remote form baseline</h1>

<p>
	Native SvelteKit remote form: Kit owns the transport names, values and form attachment. This
	page proves the baseline behaviour the Formsnap remote integration has to preserve.
</p>

<form {...saveRemote} data-testid="remote-form">
	<label for="remote-handle">Handle</label>
	<input id="remote-handle" {...saveRemote.fields.handle.as("text")} />
	{#each saveRemote.fields.handle.issues() ?? [] as issue}
		<p data-issue="handle">{issue.message}</p>
	{/each}

	<label for="remote-seats">Seats</label>
	<input id="remote-seats" {...saveRemote.fields.seats.as("number")} />

	<label for="remote-notifications">Notifications</label>
	<input id="remote-notifications" {...saveRemote.fields.notifications.as("checkbox")} />

	<label for="remote-password">Password</label>
	<input id="remote-password" {...saveRemote.fields._password.as("password")} />

	<button>Save</button>
</form>

{#if saveRemote.result}
	<output data-testid="remote-result">{JSON.stringify(saveRemote.result)}</output>
{/if}
