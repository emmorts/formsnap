import { resolve } from "$app/paths";

export const site = {
	name: "Formsnap",
	tagline: "Accessible form primitives for Superforms",
	description:
		"Formsnap wires SvelteKit Superforms data into labels, controls, descriptions and errors — type-safe and accessible by default.",
	repoUrl: "https://github.com/emmorts/formsnap",
	packageName: "@emmorts/formsnap",
} as const;

export type NavItem = { title: string; href: string };
export type NavSection = { title: string; items: NavItem[] };

/**
 * Sidebar navigation, in display order. Hrefs go through `resolve` here so the GitHub Pages base
 * path is applied once, at the source, and every consumer links to the same final path.
 */
export const navigation: NavSection[] = [
	{
		title: "Getting started",
		items: [
			{ title: "Introduction", href: resolve("/docs") },
			{ title: "Installation", href: resolve("/docs/installation") },
			{ title: "Quickstart", href: resolve("/docs/quickstart") },
		],
	},
	{
		title: "Guides",
		items: [
			{ title: "Progressive enhancement", href: resolve("/docs/guides/enhancement") },
			{ title: "Accessibility", href: resolve("/docs/guides/accessibility") },
			{ title: "Migration & troubleshooting", href: resolve("/docs/guides/migration") },
		],
	},
	{
		title: "Components",
		items: [
			{ title: "Field", href: resolve("/docs/components/field") },
			{ title: "Control", href: resolve("/docs/components/control") },
			{ title: "Label", href: resolve("/docs/components/label") },
			{ title: "Description", href: resolve("/docs/components/description") },
			{ title: "FieldErrors", href: resolve("/docs/components/field-errors") },
			{ title: "Fieldset & Legend", href: resolve("/docs/components/fieldset") },
			{ title: "ElementField", href: resolve("/docs/components/element-field") },
		],
	},
	{
		title: "Recipes",
		items: [
			{ title: "Nested data & object arrays", href: resolve("/docs/recipes/nested-data") },
			{ title: "Primitive arrays", href: resolve("/docs/recipes/primitive-arrays") },
			{ title: "File uploads", href: resolve("/docs/recipes/file-uploads") },
			{ title: "Constraints & custom validity", href: resolve("/docs/recipes/constraints") },
			{ title: "Custom controls", href: resolve("/docs/recipes/custom-controls") },
			{ title: "Groups", href: resolve("/docs/recipes/groups") },
			{ title: "Native & composite widgets", href: resolve("/docs/recipes/widgets") },
			{ title: "Multiple forms", href: resolve("/docs/recipes/multiple-forms") },
			{ title: "Pending & success feedback", href: resolve("/docs/recipes/feedback") },
			{ title: "Form-wide error summaries", href: resolve("/docs/recipes/error-summary") },
			{ title: "Conditional multi-step forms", href: resolve("/docs/recipes/multi-step") },
		],
	},
	{
		title: "Reference",
		items: [
			{ title: "Headless hooks", href: resolve("/docs/reference/headless-hooks") },
			{ title: "Changelog", href: resolve("/changelog") },
		],
	},
];

/** Pages that render with the docs sidebar; every other route is full width. */
export function isDocsRoute(pathname: string): boolean {
	return pathname.startsWith(resolve("/docs"));
}
