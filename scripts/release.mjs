#!/usr/bin/env node
// One-command release for @emmorts/formsnap:
//
//   npm run release -- 2.2.0
//
// It requires main to match origin/main, a free tag and a clean working tree apart from
// the changelog. It generates a dated version section from Unreleased, bumps the manifest,
// commits, creates an annotated tag and pushes both atomically. CI publishes to npm and
// creates the GitHub release from the generated changelog section.
//
// Only plain `X.Y.Z` versions are accepted: a prerelease would have to be published under a
// different npm dist-tag, which this pipeline deliberately does not do.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { prepareChangelog } from "./release-notes.mjs";

const PACKAGE_JSON = "packages/formsnap/package.json";
const CHANGELOG = "packages/formsnap/CHANGELOG.md";

const fail = (message) => {
	console.error(`release: ${message}`);
	process.exit(1);
};

const gitOut = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const runGit = (...args) => execFileSync("git", args, { stdio: "inherit" });

const args = process.argv.slice(2).filter((arg) => arg !== "--yes");
const assumeYes = args.length !== process.argv.slice(2).length;
if (args.length !== 1) fail("usage: npm run release -- <version> [--yes]");
const [version] = args;

if (!/^\d+\.\d+\.\d+$/.test(version)) {
	fail(`'${version}' is not a plain X.Y.Z version (prereleases are not supported)`);
}

const rank = (value) => value.split(".").map((part) => Number(part));
const [major, minor, patch] = rank(version);
const manifest = readFileSync(PACKAGE_JSON, "utf8");
const currentVersion = JSON.parse(manifest).version;
const [curMajor, curMinor, curPatch] = rank(currentVersion);
const isNewer =
	major > curMajor ||
	(major === curMajor && minor > curMinor) ||
	(major === curMajor && minor === curMinor && patch > curPatch);
if (!isNewer) fail(`${version} is not newer than the version in ${PACKAGE_JSON}`);

const dirty = gitOut("status", "--porcelain")
	.split("\n")
	.filter(Boolean)
	.filter((line) => !line.endsWith(CHANGELOG));
if (dirty.length > 0) {
	fail(`the working tree has changes other than ${CHANGELOG}:\n  ${dirty.join("\n  ")}`);
}

if (gitOut("rev-parse", "--abbrev-ref", "HEAD") !== "main") fail("releases are cut from main");
gitOut("fetch", "origin", "main");
if (gitOut("rev-parse", "HEAD") !== gitOut("rev-parse", "origin/main")) {
	fail("main is not level with origin/main — push or pull first");
}
if (gitOut("tag", "--list", `v${version}`)) fail(`tag v${version} already exists locally`);
if (gitOut("ls-remote", "--tags", "origin", `refs/tags/v${version}`)) {
	fail(`tag v${version} already exists on origin`);
}

let changelog;
try {
	changelog = prepareChangelog(readFileSync(CHANGELOG, "utf8"), version, currentVersion);
} catch (error) {
	fail(error.message);
}

if (!assumeYes) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const answer = await rl.question(
		`Release v${version}? It will bump, commit, tag and push. [y/N] `
	);
	rl.close();
	if (answer.trim().toLowerCase() !== "y") fail("aborted");
}

const bumped = manifest.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`);
if (bumped === manifest) fail(`could not find a version field in ${PACKAGE_JSON}`);
writeFileSync(PACKAGE_JSON, bumped);
writeFileSync(CHANGELOG, changelog);

runGit("add", PACKAGE_JSON, CHANGELOG);
runGit("commit", "-m", `chore(release): ${version}`);
runGit("tag", "-a", `v${version}`, "-m", `v${version}`);
runGit("push", "--atomic", "origin", "main", `refs/tags/v${version}`);

console.log(`\nv${version} pushed. CI publishes it to npm and creates the GitHub release.`);
console.log("Follow it with: gh run list --workflow=release.yml --limit 3");
