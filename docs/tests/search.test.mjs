import assert from "node:assert/strict";
import test from "node:test";
import { indexPage } from "../src/lib/search-index.server.ts";
import { searchDocumentation } from "../src/lib/search.ts";

test("section links preserve rendered heading text, duplicate IDs and code-fence boundaries", () => {
	const source = [
		"---",
		"title: Headless hooks",
		"description: Reusable controls",
		"---",
		"## `useFormField`",
		"Read field errors.",
		"```svelte",
		"## Not a heading",
		"```",
		"## Prefix**Suffix**",
		"A formatted heading.",
		"## `useFormField`",
		"A second section.",
	].join("\n");
	const entries = indexPage(source, "/formsnap/docs/hooks", "Fallback");
	assert.deepEqual(
		entries.map(({ href }) => href),
		[
			"/formsnap/docs/hooks",
			"/formsnap/docs/hooks#useformfield",
			"/formsnap/docs/hooks#prefixsuffix",
			"/formsnap/docs/hooks#useformfield-1",
		]
	);
	assert.equal(entries[1].section, "useFormField");
	assert.equal(entries[1].title, "Headless hooks");
	assert.equal(entries[0].text, "Reusable controls");
});

test("search requires every term and ranks matching section names above incidental body matches", () => {
	const entries = [
		{
			href: "/docs/a#transport",
			title: "Native forms",
			section: "Transport",
			text: "Array errors stay with their rows.",
		},
		{
			href: "/docs/b#array-errors",
			title: "Arrays",
			section: "Array errors",
			text: "Preserve stable row identity.",
		},
		{
			href: "/docs/c#array",
			title: "Arrays",
			section: "Array values",
			text: "Read values at an index.",
		},
	];
	assert.deepEqual(
		searchDocumentation(entries, " ARRAY errors array ").map(({ href }) => href),
		["/docs/b#array-errors", "/docs/a#transport"]
	);
	assert.deepEqual(searchDocumentation(entries, "array missing"), []);
	assert.deepEqual(searchDocumentation(entries, "  "), []);
});
