import assert from "node:assert/strict";
import test from "node:test";
import { indexPage } from "../src/lib/search-index.server.ts";
import { highlightSegments, searchDocumentation, tokenizeQuery } from "../src/lib/search.ts";

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
	{
		href: "/docs/recipes",
		title: "Recipes",
		section: "",
		text: "Runnable SvelteKit examples.",
	},
	{
		href: "/docs/components/fieldset",
		title: "Fieldset & Legend",
		section: "",
		text: "Groups related controls under an accessible title.",
	},
	{
		href: "/docs/reference/headless-hooks#useformfield",
		title: "Headless hooks",
		section: "useFormField",
		text: "Read field errors and constraints.",
	},
	{
		href: "/docs/changelog",
		title: "Changelog",
		section: "2.2.6",
		text: "Café release notes for arrays.",
	},
];

const hrefs = (query) =>
	searchDocumentation(entries, query).results.map((result) => result.entry.href);

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

test("indexed descriptions keep their words but drop inline Markdown markers", () => {
	const source = [
		"---",
		"title: Groups",
		"description: Group controls with a native `Fieldset`/`Legend`, or use the **child** snippet.",
		"---",
		"## Section",
		"",
		"Body text.",
	].join("\n");
	const [page] = indexPage(source, "/formsnap/docs/recipes/groups", "Groups");
	assert.equal(
		page.text,
		"Group controls with a native Fieldset/Legend, or use the child snippet."
	);
});

test("every term must match, and section names outrank incidental body matches", () => {
	const outcome = searchDocumentation(entries, " ARRAY errors array ");
	assert.deepEqual(
		outcome.results.map(({ entry }) => entry.href),
		["/docs/b#array-errors", "/docs/a#transport"]
	);
	assert.equal(outcome.complete, true);
	assert.deepEqual(outcome.terms, ["array", "errors"]);
	assert.deepEqual(searchDocumentation(entries, "   ").results, []);
});

test("terms typed with or without identifier boundaries reach the same section", () => {
	for (const query of ["useFormField", "useformfield", "usef", "form field"]) {
		assert.equal(hrefs(query)[0], "/docs/reference/headless-hooks#useformfield", query);
	}
});

test("a misspelled word still finds the nearest section", () => {
	assert.equal(hrefs("recpie")[0], "/docs/recipes");
	assert.equal(hrefs("fieldst")[0], "/docs/components/fieldset");
	assert.equal(hrefs("array errros")[0], "/docs/b#array-errors");
});

test("when no section matches every word, related sections come back flagged", () => {
	const outcome = searchDocumentation(entries, "array missing");
	assert.equal(outcome.complete, false);
	assert.deepEqual(
		outcome.results.map(({ entry, matched }) => [entry.href, matched]),
		[
			["/docs/b#array-errors", 1],
			["/docs/c#array", 1],
			["/docs/a#transport", 1],
			// "arrays" still starts with the word "array", so the changelog counts as related.
			["/docs/changelog", 1],
		]
	);
	assert.deepEqual(searchDocumentation(entries, "zzzxqnomatch").results, []);
});

test("highlight ranges point back into the original text", () => {
	const [hook] = searchDocumentation(entries, "usef").results;
	assert.deepEqual(hook.sectionRanges, [[0, 4]]);
	// The joined form matched, so the highlight covers the characters it spans: "useF" of "useFormField".
	assert.deepEqual(highlightSegments(hook.entry.section, hook.sectionRanges), [
		{ text: "useF", match: true },
		{ text: "ormField", match: false },
	]);

	const [changelog] = searchDocumentation(entries, "cafe").results;
	assert.deepEqual(changelog.snippetRanges, [[0, 4]]);
	assert.deepEqual(highlightSegments(changelog.snippet, changelog.snippetRanges)[0], {
		text: "Café",
		match: true,
	});
});

test("long body text is windowed around the match and stays inside the snippet", () => {
	const long = {
		href: "/docs/long",
		title: "Long page",
		section: "Deep section",
		text: `${"Filler sentence about nothing in particular. ".repeat(12)}Constraint lookup keeps indices. ${"Trailing words. ".repeat(6)}`,
	};
	const [result] = searchDocumentation([long], "constraint").results;
	assert.ok(result.snippet.length <= 202, result.snippet.length);
	assert.match(result.snippet, /Constraint lookup/);
	// The window opens inside the text, so it is marked as cut; the match itself stays inside it.
	assert.ok(result.snippet.startsWith("…"));
	for (const [start, end] of result.snippetRanges) {
		assert.ok(start >= 0 && end <= result.snippet.length && start < end);
		assert.equal(result.snippet.slice(start, end).toLowerCase(), "constraint");
	}
});

test("queries are split like the index, so punctuation and case do not matter", () => {
	assert.deepEqual(tokenizeQuery("  useFormField, Errors  "), ["use", "form", "field", "errors"]);
	assert.deepEqual(tokenizeQuery(""), []);
});

test("a joined identifier match must line up with whole words", () => {
	const pages = [
		{
			href: "/docs/components/field#reading-field-state",
			title: "Field",
			section: "Reading field state",
			text: "Read the field state while editing.",
		},
		{
			href: "/docs/components/fieldset",
			title: "Fieldset & Legend",
			section: "",
			text: "Groups related controls.",
		},
		{
			href: "/docs/reference/headless-hooks#useformfield",
			title: "Headless hooks",
			section: "useFormField",
			text: "Read field errors.",
		},
	];
	// "field" + "st(ate)" is contiguous in the joined form, but the word the user means is "fieldset".
	assert.equal(
		searchDocumentation(pages, "fieldst").results[0].entry.href,
		"/docs/components/fieldset"
	);
	// A whole-word span inside an identifier still matches: form + field of "useFormField".
	assert.equal(
		searchDocumentation(pages, "formfield").results[0].entry.href,
		"/docs/reference/headless-hooks#useformfield"
	);
});

test("identifier typos highlight the whole original identifier without joining arbitrary prose", () => {
	const [result] = searchDocumentation(entries, "useformfiled").results;
	assert.equal(result.entry.href, "/docs/reference/headless-hooks#useformfield");
	assert.deepEqual(result.sectionRanges, [[0, "useFormField".length]]);
	assert.deepEqual(highlightSegments(result.entry.section, result.sectionRanges), [
		{ text: "useFormField", match: true },
	]);

	const digitIdentifier = {
		href: "/docs/zod",
		title: "",
		section: "zod4Schema",
		text: "",
	};
	const [digitResult] = searchDocumentation([digitIdentifier], "zod4schmea").results;
	assert.deepEqual(digitResult.sectionRanges, [[0, digitIdentifier.section.length]]);

	for (const section of [
		"use form field",
		"use Form Field",
		"use.Form.Field",
		"use-form-field",
	]) {
		assert.deepEqual(
			searchDocumentation(
				[{ href: "/docs/prose", title: "", section, text: "" }],
				"useformfiled"
			).results,
			[],
			section
		);
	}

	for (const section of ["Reading field state", "field state"]) {
		const fieldState = { href: "/docs/field-state", title: "", section, text: "" };
		const [stateResult] = searchDocumentation([fieldState], "fieldst").results;
		// A tolerated typo may reach "field", but must never highlight the literal false span "field st".
		const start = section.indexOf("field");
		assert.deepEqual(stateResult.sectionRanges, [[start, start + "field".length]], section);
	}
	assert.equal(hrefs("fieldst")[0], "/docs/components/fieldset");
});

test("later compact occurrences remain searchable after a boundary-invalid occurrence", () => {
	for (const section of ["reform field. formField", "Reading form fieldset. formField"]) {
		const entry = { href: "/docs/later", title: "", section, text: "" };
		const [result] = searchDocumentation([entry], "formfield").results;
		assert.ok(result, section);
		const start = section.indexOf("formField");
		assert.deepEqual(result.sectionRanges, [[start, start + "formField".length]], section);
		assert.deepEqual(
			highlightSegments(section, result.sectionRanges).filter(({ match }) => match),
			[{ text: "formField", match: true }]
		);
	}
});

test("snippet word boundaries cannot skip the focused match after a long unbroken word", () => {
	const entry = {
		href: "/docs/long-word",
		title: "",
		section: "",
		text: `${"x".repeat(100)}constraint ${"tail ".repeat(50)}`,
	};
	const [result] = searchDocumentation([entry], "constraint").results;
	assert.ok(result.snippet.length <= 202, result.snippet.length);
	assert.ok(result.snippet.includes("constraint"));
	assert.deepEqual(
		highlightSegments(result.snippet, result.snippetRanges).filter(({ match }) => match),
		[{ text: "constraint", match: true }]
	);
});

test("snippet ranges are clipped to visible text rather than ellipses", () => {
	const entry = {
		href: "/docs/clipped",
		title: "",
		section: "",
		text: `alpha ${"filler ".repeat(50)}omega`,
	};
	const [result] = searchDocumentation([entry], "alpha omega").results;
	assert.equal(result.complete, true);
	assert.ok(result.snippet.endsWith("…"));
	assert.ok(result.snippet.length <= 202, result.snippet.length);
	assert.deepEqual(
		highlightSegments(result.snippet, result.snippetRanges).filter(({ match }) => match),
		[{ text: "alpha", match: true }]
	);
});
test("Unicode normalization highlights entire original code points and decomposed accents", () => {
	for (const [section, query] of [
		["𐐨", "𐐨"],
		["𝒄𝒂𝒇𝒆", "cafe"],
		["Cafe\u0301", "cafe"],
		["Ca\u0301fe\u0301", "cafe"],
	]) {
		const entry = { href: "/docs/unicode", title: "", section, text: "" };
		const [result] = searchDocumentation([entry], query).results;
		assert.ok(result, section);
		assert.deepEqual(result.sectionRanges, [[0, section.length]], section);
		assert.deepEqual(highlightSegments(section, result.sectionRanges), [
			{ text: section, match: true },
		]);
	}
	assert.deepEqual(tokenizeQuery("𐐨"), ["𐐨"]);
});

