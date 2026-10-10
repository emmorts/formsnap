// Reads the notes for a single version out of a CHANGELOG, so the release workflow and
// scripts/release.mjs agree on what a release documents.
//
// Imported as `readReleaseNotes`, or run directly by the release workflow:
//   node scripts/release-notes.mjs 2.1.1 packages/formsnap/CHANGELOG.md > release-notes.md
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Returns the body of the `## <version>` section, or null when the changelog does not document
 * that version or documents it with an empty body. The heading may carry a date after the
 * version (`## 2.1.1 (2026-10-09)`); matching on `## <version> ` rather than a prefix keeps
 * `2.1.1` from matching `2.1.10`.
 */
export function readReleaseNotes(changelogPath, version) {
	const heading = `## ${version}`;
	const lines = readFileSync(changelogPath, "utf8").split(/\r?\n/);
	const start = lines.findIndex((line) => line === heading || line.startsWith(`${heading} `));
	if (start === -1) return null;

	const body = [];
	for (let i = start + 1; i < lines.length && !lines[i].startsWith("## "); i += 1) {
		body.push(lines[i]);
	}
	return body.join("\n").trim() || null;
}

/**
 * Turns curated Unreleased entries into a dated release section and leaves an empty
 * Unreleased section for the next version. Release notes are read from this generated section.
 */
export function prepareChangelog(
	changelog,
	version,
	previousVersion,
	date = new Date().toISOString().slice(0, 10)
) {
	const lines = changelog.split(/\r?\n/);
	const heading = `## ${version}`;
	if (lines.some((line) => line === heading || line.startsWith(`${heading} `))) {
		throw new Error(`the changelog already contains ${version}`);
	}

	const start = lines.indexOf("## Unreleased");
	if (start === -1 || start !== lines.lastIndexOf("## Unreleased")) {
		throw new Error("the changelog must contain exactly one '## Unreleased' section");
	}
	let end = start + 1;
	while (end < lines.length && !lines[end].startsWith("## ")) end += 1;
	const notes = lines
		.slice(start + 1, end)
		.join("\n")
		.trim();
	if (
		!notes
			.replace(/^#{3,6} .*$/gm, "")
			.replace(/<!--[\s\S]*?-->/g, "")
			.trim()
	) {
		throw new Error("the Unreleased section has no release notes");
	}

	lines.splice(
		start + 1,
		end - start - 1,
		"",
		`## ${version} (${date})`,
		"",
		notes,
		"",
		`[Full changelog](https://github.com/emmorts/formsnap/compare/v${previousVersion}...v${version})`,
		""
	);
	return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const [version, changelogPath = "CHANGELOG.md"] = process.argv.slice(2);
	const notes = version ? readReleaseNotes(changelogPath, version) : null;
	if (!notes) {
		console.error(
			`release-notes: ${changelogPath} has no '## ${version ?? "<version>"}' section with any content.`
		);
		process.exit(1);
	}
	process.stdout.write(`${notes}\n`);
}
