// A component's children are parsed as markdown only when a blank line separates them from the
// opening tag: CommonMark keeps a raw HTML block raw until a blank line ends it, so mdsvex passes
// such children through verbatim. That shipped once — the version note on
// /docs/guides/remote-functions rendered its own `**` markers — so every page is compiled here and
// fails if raw emphasis or link syntax survives in the body.
import { readFile, glob } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "mdsvex";

// mdsvex's own compiler. The site runs it through the Vite plugin with a Shiki highlighter as well as
// rehype plugins for headings, table containers and base-path links; none of those can change whether
// the markdown around a component was parsed, and they would add a highlighter dependency here, so the
// default highlighter is used and fenced code is excluded from the check.
async function compiledBody(source, filename) {
	const { code = "" } =
		(await compile(source, { extensions: [".svx", ".md"], filename, highlight: false })) ?? {};
	// Frontmatter descriptions carry inline markdown that the layout renders with inlineHtml, and a
	// code sample may contain `**` (a JSDoc comment, a glob) — neither is unparsed body markdown.
	return code.replace(/<pre[\s\S]*?<\/pre>/g, "");
}

const stripFrontmatter = (source) => source.replace(/^---\n[\s\S]*?\n---\n/, "");

test("every documentation page parses the markdown it writes", async () => {
	const files = (
		await Promise.all(
			["src/routes/docs/**/+page.svx", "src/routes/docs/**/+page.md"].map((pattern) =>
				Array.fromAsync(glob(pattern))
			)
		)
	)
		.flat()
		.sort();
	// Guard the glob itself: a silent pattern change would otherwise make this test vacuous.
	assert.ok(
		files.some((file) => file.endsWith("guides/remote-functions/+page.svx")),
		`the documentation pages were not found, only: ${files.join(", ")}`
	);

	const offenders = [];
	for (const file of files) {
		const body = await compiledBody(stripFrontmatter(await readFile(file, "utf8")), file);
		for (const marker of ["**", "]("]) {
			const count = body.split(marker).length - 1;
			if (count) offenders.push(`${file}: ${count} x "${marker}"`);
		}
	}

	assert.deepEqual(
		offenders,
		[],
		`raw markdown survived compilation, so a component's children were not parsed:\n${offenders.join("\n")}`
	);
});
