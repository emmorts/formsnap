/**
 * Wraps every markdown table in a scroll container so wide prop and option tables scroll
 * horizontally on narrow screens instead of widening the page. Written as a local plugin to avoid
 * pulling a markdown transform dependency for one edit.
 *
 * @typedef {import('hast').Element} Element
 * @typedef {import('hast').Root} Root
 * @typedef {import('hast').RootContent} RootContent
 */

/**
 * Depth-first walk; tables can appear inside other block elements.
 *
 * @param {Root | Element} parent
 */
function walk(parent) {
	const children = /** @type {RootContent[]} */ (parent.children);

	for (let index = 0; index < children.length; index++) {
		const child = children[index];
		if (child.type === "element" && child.tagName === "table") {
			children[index] = {
				type: "element",
				tagName: "div",
				properties: { className: ["table-scroll"] },
				children: [child],
			};
			continue;
		}
		if (child.type === "element") walk(child);
	}
}

/**
 * @returns {(tree: Root) => void}
 */
export function rehypeTableScroll() {
	return (tree) => {
		walk(tree);
	};
}
