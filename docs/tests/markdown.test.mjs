import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";
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

test("ordinary references decode once into text, never into markup", () => {
	const source =
		"Fish &amp; chips &copy; &#169; &#x1F642; &eacute; &lt;strong&gt;not markup&lt;/strong&gt; &unknown; &copy &amp;copy;";
	const expected = "Fish & chips © © 🙂 é <strong>not markup</strong> &unknown; &copy &copy;";
	const { document } = parseHTML(`<html><body>${inlineHtml(source)}</body></html>`);

	assert.equal(inlinePlain(source), expected);
	assert.equal(document.body.textContent, expected);
	assert.equal(document.body.children.length, 0);
});

test("code spans and escaped entity syntax keep their literal spelling", () => {
	const source = "`&amp; &#169; &lt;b&gt;` \\&amp; \\&#169; \\&lt;b\\&gt; &amp;";
	const expected = "&amp; &#169; &lt;b&gt; &amp; &#169; &lt;b&gt; &";
	const { document } = parseHTML(`<html><body>${inlineHtml(source)}</body></html>`);

	assert.equal(inlinePlain(source), expected);
	assert.equal(document.body.textContent, expected);
	assert.equal(document.querySelector("code").textContent, "&amp; &#169; &lt;b&gt;");
	assert.equal(document.querySelector("b"), null);
});

test("image alt text decodes ordinary references while keeping code and escapes literal", () => {
	const source = "![Fish &amp; **chips** &#x1F642; `&copy;` \\&amp;](/image.png)";
	const expected = "Fish & chips 🙂 &copy; &amp;";
	const { document } = parseHTML(`<html><body>${inlineHtml(source)}</body></html>`);

	assert.equal(inlinePlain(source), expected);
	assert.equal(document.body.textContent, expected);
	assert.equal(document.body.children.length, 0);
});

test("entity-bearing destinations retain query parameters after HTML parsing", () => {
	for (const destination of [
		"https://example.com/search?a=1&amp;b=2",
		"https://example.com/search?a=1&#38;b=2",
		"https://example.com/search?a=1&#x26;b=2",
	]) {
		const source = `[Fish &amp; chips](${destination})`;
		const { document } = parseHTML(`<html><body>${inlineHtml(source)}</body></html>`);
		const anchor = document.querySelector("a");
		assert.ok(anchor, destination);
		const url = new URL(anchor.getAttribute("href"));

		assert.equal(url.searchParams.get("a"), "1", destination);
		assert.equal(url.searchParams.get("b"), "2", destination);
		assert.deepEqual([...url.searchParams.keys()], ["a", "b"], destination);
		assert.equal(anchor.textContent, "Fish & chips", destination);
		assert.equal(inlinePlain(source), "Fish & chips", destination);
	}
});

test("executable and unknown schemes render labels without anchors", () => {
	assert.equal(inlineHtml("[Run](javascript:alert(1))"), "Run");
	assert.equal(inlineHtml("[Run](data:text/plain,test)"), "Run");

	for (const destination of [
		"javascript:alert(1)",
		"JaVaScRiPt:alert(1)",
		"jav&#x61;script:alert(1)",
		"javascript&colon;alert(1)",
		"java&#9;script:alert(1)",
		"java&#10;script:alert(1)",
		"java&#13;script:alert(1)",
		"java&Tab;script:alert(1)",
		"java&NewLine;script:alert(1)",
		"&#1;javascript:alert(1)",
		"&#32;javascript:alert(1)",
		"java\tscript:alert(1)",
		"java\rscript:alert(1)",
		"data:text/html;base64,PHNjcmlwdD4=",
		"DaTa:text/plain,test",
		"d&#97;ta:text/plain,test",
		"vbscript:msgbox(1)",
		"VbScRiPt:msgbox(1)",
		"vb&#9;script:msgbox(1)",
		"ftp://example.com/file",
		"custom:destination",
	]) {
		const source = `[**Safe** &amp; sound](<${destination}>)`;
		const { document } = parseHTML(
			`<html><body>${inlineHtml(source, { base: "/formsnap" })}</body></html>`
		);

		assert.equal(document.querySelector("a"), null, destination);
		assert.equal(document.body.textContent, "Safe & sound", destination);
		assert.equal(document.querySelector("strong").textContent, "Safe", destination);
		assert.equal(inlinePlain(source), "Safe & sound", destination);
	}
});

test("permitted destinations keep their targets and deployment base behavior", () => {
	for (const [destination, expected] of [
		["http://example.com/docs", "http://example.com/docs"],
		["HTTPS://example.com/docs", "HTTPS://example.com/docs"],
		["mailto:team@example.com", "mailto:team@example.com"],
		["tel:+123456789", "tel:+123456789"],
		["docs/guide", "docs/guide"],
		["../guide", "../guide"],
		["?a=1&amp;b=2", "?a=1&b=2"],
		["/docs/guide", "/formsnap/docs/guide"],
		["&#x2F;docs/guide", "/formsnap/docs/guide"],
		["//example.com/docs", "//example.com/docs"],
		["#details", "#details"],
	]) {
		const { document } = parseHTML(
			`<html><body>${inlineHtml(`[Guide](${destination})`, { base: "/formsnap" })}</body></html>`
		);
		const anchor = document.querySelector("a");

		assert.ok(anchor, destination);
		assert.equal(anchor.getAttribute("href"), expected, destination);
		assert.equal(anchor.textContent, "Guide", destination);
	}
});
