/**
 * Prefixes root-relative link targets with the deployment base path. Markdown links are written as
 * ordinary app paths (`/docs/quickstart`); on a site served from a subdirectory, such as the GitHub
 * Pages project path, those would point outside the site. SvelteKit's `resolve()` handles links in
 * components, but plain markdown anchors are not touched by it.
 *
 * Registered as `[rehypeBaseLinks, base]` in docs/svelte.config.js, so the base arrives as a
 * unified option.
 *
 * @typedef {import('hast').Element} Element
 * @typedef {import('hast').Root} Root
 * @typedef {import('hast').RootContent} RootContent
 */

/**
 * @param {Root | Element} parent
 * @param {string} base
 */
function walk(parent, base) {
	const children = /** @type {RootContent[]} */ (parent.children);

	for (const child of children) {
		if (child.type !== "element") continue;

		if (child.tagName === "a") {
			const href = child.properties?.href;
			// Leave absolute URLs, protocol-relative URLs and in-page anchors alone.
			if (typeof href === "string" && href.startsWith("/") && !href.startsWith("//")) {
				child.properties.href = `${base}${href}`;
			}
		}

		walk(child, base);
	}
}

/**
 * @param {string} [base] The configured `paths.base`, for example "/formsnap". Defaults to "", which
 * leaves links untouched; the option is dropped entirely when a build passes an empty base.
 * @returns {(tree: Root) => void}
 */
export function rehypeBaseLinks(base = "") {
	return (tree) => {
		walk(tree, base);
	};
}
