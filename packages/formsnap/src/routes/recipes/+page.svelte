<script lang="ts">
	import { resolve } from "$app/paths";

	/**
	 * Index of the integration recipes. Each entry is a runnable form in this fixture app, and the
	 * consumer tests exercise the same pages the documentation quotes.
	 */
	const recipes = [
		{
			path: "/recipes/upload",
			title: "File upload",
			description:
				"A file input inside a Field. The action reads a File from the multipart submission.",
		},
		{
			path: "/recipes/constraints",
			title: "Native constraints",
			description:
				"HTML validation attributes, schema-derived aria-required, and the customValidity option.",
		},
		{
			path: "/recipes/composition",
			title: "Custom composition",
			description:
				"Child snippets, ref forwarding, and a control built on the headless hooks.",
		},
		{
			path: "/recipes/feedback",
			title: "Pending and success feedback",
			description:
				"The submitting store while the action runs, and a Superforms message after.",
		},
	] as const;
</script>

<h1>Recipes</h1>
<p>
	Each recipe is a complete form in this fixture app. The consumer tests load these pages, so the
	documentation and the code cannot drift apart silently.
</p>
<ul>
	{#each recipes as recipe (recipe.path)}
		<li>
			<a href={resolve(recipe.path)}>{recipe.title}</a>
			— <code>{recipe.path}</code>: {recipe.description}
		</li>
	{/each}
</ul>
