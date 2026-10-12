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
			path: "/recipes/groups",
			title: "Native and custom groups",
			description:
				"Native fieldset semantics beside a caller-owned group and a headless checkbox control.",
		},
		{
			path: "/recipes/widgets",
			title: "Native and composite widgets",
			description:
				"Native radios and multiple select beside a keyboard-capable composite widget.",
		},
		{
			path: "/recipes/feedback",
			title: "Pending and success feedback",
			description:
				"The submitting store while the action runs, and a Superforms message after.",
		},
		{
			path: "/recipes/announcements",
			title: "Error announcements",
			description:
				"The announcement policy of an owned or standalone error region, and what each one costs.",
		},
		{
			path: "/recipes/errors",
			title: "Form-wide errors and summaries",
			description:
				"Root validation, a single announcement policy, and caller-owned links to conditional controls.",
		},
		{
			path: "/recipes/remote",
			title: "Native remote form",
			description:
				"One native SvelteKit remote form presented by Formsnap, with a rejection, a refused domain result, and an explicit reset policy.",
		},
		{
			path: "/recipes/remote-feedback",
			title: "Remote rejection feedback",
			description:
				"Every rejection layer of a native remote form behind one announcement policy, with linked and unlinked summary entries.",
		},
		{
			path: "/recipes/remote-instances",
			title: "Remote form instances",
			description:
				"Repeated form.for(id) instances with isolation, a custom control, a submitted file, an explicit reset policy and a refused duplicate attachment.",
		},
		{
			path: "/recipes/remote-command",
			title: "Superforms with a remote command",
			description:
				"A real SuperForm whose submission is an application-owned remote command, translated into Superforms state, with a query refresh and application navigation.",
		},
		{
			path: "/recipes/multi-step",
			title: "Conditional multi-step form",
			description:
				"Step validation, retained drafts, accessible error navigation, and final server validation with a native fallback.",
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
