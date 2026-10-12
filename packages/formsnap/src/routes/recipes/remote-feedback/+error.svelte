<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
</script>

<h1>Something went wrong</h1>

<p>
	An unexpected failure is not a validation outcome, so it is not rendered as form feedback. This
	boundary is where the recipe's thrown handler surfaces, in the browser and on the server alike.
</p>

<p>
	What a handler throws is not what a browser is told: the message below is the sanitized one
	SvelteKit sends for an unexpected failure, and the handler's own text stays in the server log.
	Mapping an error to a client-safe message is <code>handleError</code>'s job, not the boundary's.
</p>

<p data-testid="feedback-error">{page.error?.message}</p>

<a href={resolve("/recipes/remote-feedback")} data-testid="feedback-error-retry">Back to the form</a
>
