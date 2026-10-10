<script lang="ts">
	/**
	 * Index of the integration recipes. Each entry is a runnable form in this fixture app, and the
	 * consumer tests exercise the same pages the documentation quotes.
	 */
	const recipes = [
		{
			href: "/recipes/upload",
			title: "File upload",
			description:
				"A file input inside a Field. The action reads a File from the multipart submission.",
		},
		{
			href: "/recipes/constraints",
			title: "Native constraints",
			description:
				"HTML validation attributes, schema-derived aria-required, and the customValidity option.",
		},
		{
			href: "/recipes/composition",
			title: "Custom composition",
			description:
				"Child snippets, ref forwarding, and a control built on the headless hooks.",
		},
		{
			href: "/recipes/feedback",
			title: "Pending and success feedback",
			description:
				"The submitting store while the action runs, and a Superforms message after.",
		},
	];
</script>

<h1>Recipes</h1>
<p>
	Each recipe is a complete form in this fixture app. The consumer tests load these pages, so the
	documentation and the code cannot drift apart silently.
</p>
<ul>
	{#each recipes as recipe (recipe.href)}
		<li>
			<a href={recipe.href}>{recipe.title}</a>
			— {recipe.description}
		</li>
	{/each}
</ul>
