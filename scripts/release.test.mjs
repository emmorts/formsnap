import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { prepareChangelog, readReleaseNotes } from "./release-notes.mjs";

const releaseScript = fileURLToPath(new URL("./release.mjs", import.meta.url));
const notesScript = fileURLToPath(new URL("./release-notes.mjs", import.meta.url));
const entries =
	"### Added\n\n- Add owned error slots.\n\n### Fixed\n\n- Preserve field associations.";
const history = "## 2.1.1 (2026-10-09)\n\nNo functional changes.\n";
const changelog = `# Changelog\n\n## Unreleased\n\n${entries}\n\n${history}`;
const comparison = "[Full changelog](https://github.com/emmorts/formsnap/compare/v2.1.1...v2.2.0)";

function temporaryDirectory(t) {
	const directory = mkdtempSync(path.join(tmpdir(), "formsnap-release-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	return directory;
}

test("promotes Unreleased entries without mixing in release history", (t) => {
	const generated = prepareChangelog(changelog, "2.2.0", "2.1.1", "2026-10-10");
	const filename = path.join(temporaryDirectory(t), "CHANGELOG.md");
	writeFileSync(filename, generated);
	assert.equal(readReleaseNotes(filename, "Unreleased"), null);
	assert.equal(readReleaseNotes(filename, "2.2.0"), `${entries}\n\n${comparison}`);
	assert.equal(readReleaseNotes(filename, "2.1.1"), "No functional changes.");
	assert.ok(generated.includes("## 2.2.0 (2026-10-10)"));
	assert.ok(generated.endsWith(history));
});

test("handles a first release at end of file and Windows line endings", () => {
	const generated = prepareChangelog(
		"# Changelog\r\n\r\n## Unreleased\r\n\r\n- First feature.",
		"1.0.0",
		"0.0.0",
		"2026-10-10"
	);
	assert.ok(generated.includes("## Unreleased\n\n## 1.0.0 (2026-10-10)\n\n- First feature."));
	assert.ok(generated.includes("compare/v0.0.0...v1.0.0"));
});

test("rejects missing or ambiguous Unreleased sections", () => {
	assert.throws(() => prepareChangelog(history, "2.2.0", "2.1.1"), /exactly one/);
	assert.throws(
		() => prepareChangelog(`${changelog}\n## Unreleased\n\n- Another entry.`, "2.2.0", "2.1.1"),
		/exactly one/
	);
});

test("rejects empty and heading-only release notes", () => {
	for (const body of ["", "### Added\n\n<!-- Awaiting changes. -->"]) {
		assert.throws(
			() => prepareChangelog(`## Unreleased\n\n${body}\n\n${history}`, "2.2.0", "2.1.1"),
			/no release notes/
		);
	}
});

test("does not overwrite an existing version or match a version prefix", (t) => {
	assert.throws(
		() =>
			prepareChangelog(
				`${changelog}\n## 2.2.0 (2026-10-10)\n\nAlready released.`,
				"2.2.0",
				"2.1.1"
			),
		/already contains/
	);
	const filename = path.join(temporaryDirectory(t), "CHANGELOG.md");
	writeFileSync(filename, "## 2.1.10\n\nA different release.\n");
	assert.equal(readReleaseNotes(filename, "2.1.1"), null);
});

function releaseRepository(t, initialChangelog = changelog) {
	const directory = temporaryDirectory(t);
	const cwd = path.join(directory, "working");
	const origin = path.join(directory, "origin.git");
	mkdirSync(cwd);
	const env = {
		...process.env,
		GIT_CONFIG_NOSYSTEM: "1",
		GIT_CONFIG_GLOBAL: "/dev/null",
		GIT_AUTHOR_NAME: "Release test",
		GIT_AUTHOR_EMAIL: "release@example.invalid",
		GIT_COMMITTER_NAME: "Release test",
		GIT_COMMITTER_EMAIL: "release@example.invalid",
	};
	const git = (...args) =>
		execFileSync("git", args, {
			cwd,
			env,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	git("init", "--bare", origin);
	git("init", "-b", "main");
	git("remote", "add", "origin", origin);
	mkdirSync(path.join(cwd, "packages/formsnap"), { recursive: true });
	writeFileSync(
		path.join(cwd, "packages/formsnap/package.json"),
		'{"name":"@emmorts/formsnap","version":"2.1.1"}\n'
	);
	writeFileSync(path.join(cwd, "packages/formsnap/CHANGELOG.md"), initialChangelog);
	writeFileSync(path.join(cwd, ".gitignore"), "/docs/implementation-plan.md\n");
	git("add", ".");
	git("commit", "-m", "Initial release fixture");
	git("tag", "v2.1.1");
	git("push", "-u", "origin", "main", "v2.1.1");
	mkdirSync(path.join(cwd, "docs"));
	writeFileSync(path.join(cwd, "docs/implementation-plan.md"), "Private local plan.\n");
	const run = () =>
		spawnSync(process.execPath, [releaseScript, "2.2.0", "--yes"], {
			cwd,
			env,
			encoding: "utf8",
		});
	return { cwd, origin, env, git, run };
}

test("releases through the actual CLI and keeps the local plan private", (t) => {
	const { cwd, origin, env, git, run } = releaseRepository(t);
	const result = run();
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
	const remoteManifest = JSON.parse(
		git("--git-dir", origin, "show", "main:packages/formsnap/package.json")
	);
	assert.equal(remoteManifest.version, "2.2.0");
	assert.equal(
		git("--git-dir", origin, "rev-parse", "main"),
		git("--git-dir", origin, "rev-parse", "v2.2.0^{commit}")
	);
	assert.equal(git("--git-dir", origin, "cat-file", "-t", "v2.2.0"), "tag");
	assert.equal(
		git("--git-dir", origin, "ls-tree", "--name-only", "main", "docs/implementation-plan.md"),
		""
	);
	assert.equal(
		readFileSync(path.join(cwd, "docs/implementation-plan.md"), "utf8"),
		"Private local plan.\n"
	);
	const notes = execFileSync(
		process.execPath,
		[notesScript, "2.2.0", "packages/formsnap/CHANGELOG.md"],
		{ cwd, env, encoding: "utf8" }
	);
	assert.equal(notes, `${entries}\n\n${comparison}\n`);
});

test("refuses an empty release before changing files or creating a tag", (t) => {
	const { cwd, git, run } = releaseRepository(t, `## Unreleased\n\n${history}`);
	const before = git("rev-parse", "HEAD");
	const manifest = readFileSync(path.join(cwd, "packages/formsnap/package.json"), "utf8");
	const result = run();
	assert.equal(result.status, 1);
	assert.match(result.stderr, /no release notes/);
	assert.equal(git("rev-parse", "HEAD"), before);
	assert.equal(readFileSync(path.join(cwd, "packages/formsnap/package.json"), "utf8"), manifest);
	assert.equal(git("tag", "--list", "v2.2.0"), "");
});

test("an atomic push does not advance remote main when the tag is rejected", (t) => {
	const { origin, git, run } = releaseRepository(t);
	const before = git("--git-dir", origin, "rev-parse", "main");
	writeFileSync(
		path.join(origin, "hooks/pre-receive"),
		'#!/bin/sh\nwhile read old new ref; do\n  case "$ref" in refs/tags/v2.2.0) exit 1 ;; esac\ndone\n',
		{ mode: 0o755 }
	);
	const result = run();
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /atomic push failed|pre-receive hook declined/);
	assert.equal(git("--git-dir", origin, "rev-parse", "main"), before);
	assert.equal(git("--git-dir", origin, "tag", "--list", "v2.2.0"), "");
});
