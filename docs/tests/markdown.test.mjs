import assert from "node:assert/strict";
import test from "node:test";
import { inlineHtml, inlinePlain } from "../src/lib/markdown/inline.ts";

test("descriptions keep inline formatting, and plain text drops the markers", () => {
	const source =
		"Group controls with a native `Fieldset`/`Legend`, or use the **child** snippet — see [Groups](/docs/recipes/groups).";

	assert.equal(
		inlinePlain(source),
		"Group controls with a native Fieldset/Legend, or use the child snippet — see Groups."
	);
	assert.equal(
		inlineHtml(source, { base: "/formsnap" }),
		'Group controls with a native <code>Fieldset</code>/<code>Legend</code>, or use the <strong>child</strong> snippet — see <a href="/formsnap/docs/recipes/groups">Groups</a>.'
	);
});

test("descriptions never emit raw HTML, and links keep absolute targets untouched", () => {
	// The tags are dropped; only their text survives, so nothing in a description can execute.
	assert.equal(inlineHtml("<script>alert(1)</script>"), "alert(1)");
	assert.equal(inlineHtml("Use <b>bold</b> sparingly"), "Use bold sparingly");
	assert.equal(inlineHtml("Text & symbols < 3"), "Text &amp; symbols &lt; 3");
	assert.equal(
		inlineHtml("[W3C](https://www.w3.org/WAI/tutorials/forms/grouping/)", {
			base: "/formsnap",
		}),
		'<a href="https://www.w3.org/WAI/tutorials/forms/grouping/">W3C</a>'
	);
	assert.equal(
		inlineHtml("[Groups](/docs/recipes/groups)", {}),
		'<a href="/docs/recipes/groups">Groups</a>'
	);
	assert.equal(
		inlineHtml("[Groups](/docs/recipes/groups)", { base: "" }),
		'<a href="/docs/recipes/groups">Groups</a>'
	);
});

test("plain descriptions collapse whitespace and drop code and emphasis markers", () => {
	assert.equal(
		inlinePlain("Provides context for  `ElementField` rows,\nand  *per-item* errors."),
		"Provides context for ElementField rows, and per-item errors."
	);
	assert.equal(inlinePlain(""), "");
});

