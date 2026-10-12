<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
</script>

<h1>Something went wrong</h1>

<p>
	This boundary is where a mistake that Kit catches itself surfaces, such as attaching one form
	instance to two elements. It is also where an unexpected handler failure ends up.
</p>

<p data-testid="instances-error">{page.error?.message}</p>

<a href={resolve("/recipes/remote-instances")} data-testid="instances-error-retry"
	>Back to the lines</a
>
