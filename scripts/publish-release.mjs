#!/usr/bin/env node
// Finish a tagged release without overwriting either published artifact. The workflow builds
// first; this script packs once and publishes that exact file with npm trusted publishing.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function runNpm(args, cwd) {
	try {
		return execFileSync("npm", args, {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 180_000,
		});
	} catch {
		// npm diagnostics can contain credentials or authenticated URLs. Never echo them.
		throw new Error(`npm ${args[0]} failed; no subsequent release stage was run`);
	}
}

async function request(url, stage, options = {}) {
	try {
		return await fetch(url, {
			...options,
			redirect: "error",
			signal: AbortSignal.timeout(30_000),
		});
	} catch {
		throw new Error(`${stage} request failed`);
	}
}

async function jsonResponse(response, stage) {
	try {
		return await response.json();
	} catch {
		throw new Error(`${stage} returned invalid JSON`);
	}
}

function verifyRelease(release, tag, notes) {
	if (
		release.tag_name !== tag ||
		release.name !== tag ||
		typeof release.body !== "string" ||
		release.body.trim() !== notes ||
		release.draft !== false ||
		release.prerelease !== false
	) {
		throw new Error("existing GitHub release does not match the intended public release");
	}
}

/**
 * run is an isolated npm executable seam for local fixtures. Production always uses runNpm;
 * HTTP reads and GitHub release creation use the same code in fixtures and the workflow.
 */
export async function publishRelease({
	packageDir = "packages/formsnap",
	notesFile = "release-notes.md",
	tag = process.env.GITHUB_REF_NAME,
	repository = process.env.GITHUB_REPOSITORY,
	token = process.env.GH_TOKEN,
	registry = "https://registry.npmjs.org/",
	githubApi = "https://api.github.com/",
	run = runNpm,
}) {
	const manifest = JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf8"));
	const { name, version } = manifest;
	if (!/^\d+\.\d+\.\d+$/.test(version) || tag !== `v${version}`) {
		throw new Error("release tag must match the package's plain X.Y.Z version");
	}
	if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "") || !token) {
		throw new Error("an explicit GitHub repository and GH_TOKEN are required");
	}
	const notes = readFileSync(notesFile, "utf8").trim();
	if (!notes) throw new Error("release notes must not be empty");
	const headers = {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${token}`,
		"X-GitHub-Api-Version": "2022-11-28",
		"Content-Type": "application/json",
	};
	const api = new URL(`repos/${repository}/`, githubApi);
	const releaseUrl = new URL(`releases/tags/${encodeURIComponent(tag)}`, api);
	const packDirectory = mkdtempSync(path.join(tmpdir(), "formsnap-publish-"));
	try {
		let packed;
		try {
			packed = JSON.parse(
				await run(
					["pack", "--json", "--ignore-scripts", "--pack-destination", packDirectory],
					packageDir
				)
			);
		} catch {
			throw new Error("npm pack failed or returned invalid package metadata");
		}
		if (
			!Array.isArray(packed) ||
			packed.length !== 1 ||
			packed[0].name !== name ||
			packed[0].version !== version ||
			typeof packed[0].filename !== "string" ||
			path.basename(packed[0].filename) !== packed[0].filename
		) {
			throw new Error("npm pack did not produce the intended single package");
		}
		const tarball = path.join(packDirectory, packed[0].filename);
		const intendedHash = createHash("sha512").update(readFileSync(tarball)).digest("base64");
		const versionResponse = await request(
			new URL(`${encodeURIComponent(name)}/${encodeURIComponent(version)}`, registry),
			"npm version lookup"
		);
		let published = false;
		if (versionResponse.status === 200) {
			const metadata = await jsonResponse(versionResponse, "npm version lookup");
			if (metadata.name !== name || metadata.version !== version || !metadata.dist?.tarball) {
				throw new Error("npm returned metadata for a different or incomplete package");
			}
			// Compare the actual published bytes, not just untrusted registry integrity metadata.
			let artifactUrl;
			try {
				artifactUrl = new URL(metadata.dist.tarball);
				if (
					!/^https?:$/.test(artifactUrl.protocol) ||
					artifactUrl.username ||
					artifactUrl.password
				) {
					throw new Error();
				}
			} catch {
				throw new Error("npm returned an invalid artifact URL");
			}
			const artifactResponse = await request(artifactUrl, "npm artifact download");
			if (artifactResponse.status !== 200) {
				throw new Error(`npm artifact download returned HTTP ${artifactResponse.status}`);
			}
			let artifact;
			try {
				artifact = await artifactResponse.arrayBuffer();
			} catch {
				throw new Error("npm artifact download failed");
			}
			if (
				createHash("sha512").update(Buffer.from(artifact)).digest("base64") !== intendedHash
			) {
				throw new Error("published npm artifact does not match the intended packed output");
			}
			published = true;
		} else if (versionResponse.status !== 404) {
			throw new Error(
				`npm version lookup returned HTTP ${versionResponse.status}; absence is not established`
			);
		}

		// Preflight GitHub before any publication. A 404 release is absence only after the tag
		// lookup proves the repository and existing tag are accessible (the old --verify-tag).
		const tagResponse = await request(
			new URL(`git/ref/tags/${encodeURIComponent(tag)}`, api),
			"GitHub tag lookup",
			{ headers }
		);
		if (tagResponse.status !== 200) {
			throw new Error(`GitHub tag lookup returned HTTP ${tagResponse.status}`);
		}
		const remoteTag = await jsonResponse(tagResponse, "GitHub tag lookup");
		if (remoteTag.ref !== `refs/tags/${tag}`)
			throw new Error("GitHub returned a different tag");
		const releaseResponse = await request(releaseUrl, "GitHub release lookup", { headers });
		let releaseExists = false;
		if (releaseResponse.status === 200) {
			verifyRelease(await jsonResponse(releaseResponse, "GitHub release lookup"), tag, notes);
			releaseExists = true;
		} else if (releaseResponse.status !== 404) {
			throw new Error(`GitHub release lookup returned HTTP ${releaseResponse.status}`);
		}

		if (!published) {
			await run(
				[
					"publish",
					tarball,
					"--ignore-scripts",
					"--access",
					"public",
					"--provenance",
					"--registry",
					registry,
				],
				packageDir
			);
		}
		if (!releaseExists) {
			const created = await request(new URL("releases", api), "GitHub release creation", {
				method: "POST",
				headers,
				body: JSON.stringify({
					tag_name: tag,
					name: tag,
					body: notes,
					draft: false,
					prerelease: false,
				}),
			});
			if (created.status === 422) {
				// Another actor may have created the release since preflight. Never update it;
				// accept this race only if a fresh read proves the exact intended release exists.
				const raced = await request(releaseUrl, "GitHub release recheck", { headers });
				if (raced.status !== 200)
					throw new Error(
						`GitHub release creation returned HTTP 422; recheck returned HTTP ${raced.status}`
					);
				verifyRelease(await jsonResponse(raced, "GitHub release recheck"), tag, notes);
			} else {
				if (created.status !== 201)
					throw new Error(`GitHub release creation returned HTTP ${created.status}`);
				verifyRelease(await jsonResponse(created, "GitHub release creation"), tag, notes);
			}
		}
		return {
			npm: published ? "verified" : "published",
			github: releaseExists ? "verified" : "created",
		};
	} finally {
		rmSync(packDirectory, { recursive: true, force: true });
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const result = await publishRelease({});
		console.log(`Release complete: npm ${result.npm}; GitHub ${result.github}.`);
	} catch (error) {
		console.error(`publish-release: ${error.message}`);
		process.exitCode = 1;
	}
}
