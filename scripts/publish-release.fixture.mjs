// Local-only registry/GitHub fixture shared by node:test and the real npm-pack smoke.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { runNpm } from "./publish-release.mjs";

export async function releaseFixture({ packageDir, realPack = false } = {}) {
	const directory = mkdtempSync(path.join(tmpdir(), "formsnap-release-fixture-"));
	if (!packageDir) {
		packageDir = directory;
		writeFileSync(
			path.join(directory, "package.json"),
			JSON.stringify({ name: "@fixture/formsnap", version: "2.2.5" })
		);
	}
	packageDir = path.resolve(packageDir);
	const manifest = JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf8"));
	const tag = `v${manifest.version}`;
	const notes = "- Complete the release safely.";
	const notesFile = path.join(directory, "release-notes.txt");
	writeFileSync(notesFile, `${notes}\n`);
	const expectedRelease = {
		tag_name: tag,
		name: tag,
		body: notes,
		draft: false,
		prerelease: false,
	};
	const state = {
		artifact: null,
		release: null,
		versionStatus: null,
		versionDisconnect: false,
		artifactStatus: 200,
		tagStatus: 200,
		lookupStatus: null,
		createStatus: 201,
		createRace: false,
		publishFailure: false,
		packs: [],
		publishes: [],
		requests: [],
		creates: 0,
	};
	let origin;
	const server = createServer(async (req, res) => {
		state.requests.push({ method: req.method, url: req.url });
		const json = (status, data) => {
			res.writeHead(status, { "Content-Type": "application/json" });
			res.end(JSON.stringify(data));
		};
		if (req.url === `/registry/${encodeURIComponent(manifest.name)}/${manifest.version}`) {
			if (state.versionDisconnect) return req.socket.destroy();
			const status = state.versionStatus ?? (state.artifact ? 200 : 404);
			return json(
				status,
				status === 200
					? {
							name: manifest.name,
							version: manifest.version,
							dist: { tarball: `${origin}/registry/artifact.tgz` },
						}
					: { error: "Fixture registry error" }
			);
		}
		if (req.url === "/registry/artifact.tgz") {
			res.writeHead(state.artifactStatus);
			return res.end(state.artifact ?? "missing");
		}
		if (req.url === "/registry/publish" && req.method === "PUT") {
			const chunks = [];
			for await (const chunk of req) chunks.push(chunk);
			if (state.artifact) return json(409, { error: "Never overwrite" });
			state.artifact = Buffer.concat(chunks);
			return json(201, { ok: true });
		}
		if (req.url === `/api/repos/fixture/formsnap/git/ref/tags/${tag}`) {
			return json(state.tagStatus, { ref: `refs/tags/${tag}` });
		}
		if (req.url === `/api/repos/fixture/formsnap/releases/tags/${tag}`) {
			return json(
				state.lookupStatus ?? (state.release ? 200 : 404),
				state.release ?? { message: "Not Found" }
			);
		}
		if (req.url === "/api/repos/fixture/formsnap/releases" && req.method === "POST") {
			state.creates += 1;
			const chunks = [];
			for await (const chunk of req) chunks.push(chunk);
			const body = JSON.parse(Buffer.concat(chunks).toString());
			if (state.createRace) {
				state.release = { ...expectedRelease };
				return json(422, { message: "Already exists" });
			}
			if (state.createStatus !== 201)
				return json(state.createStatus, { message: "Fixture creation failure" });
			if (state.release) return json(422, { message: "Never overwrite" });
			state.release = body;
			return json(201, body);
		}
		return json(404, { message: "Unexpected fixture request" });
	});
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	origin = `http://127.0.0.1:${server.address().port}`;
	const registry = `${origin}/registry/`;
	const options = {
		packageDir,
		notesFile,
		tag,
		repository: "fixture/formsnap",
		token: "fixture-token-never-print",
		registry,
		githubApi: `${origin}/api/`,
		run: async (args, cwd) => {
			assert.equal(cwd, packageDir);
			if (args[0] === "pack") {
				const destination = args[args.indexOf("--pack-destination") + 1];
				state.packs.push(destination);
				if (realPack) return runNpm(args, cwd);
				const filename = "fixture-formsnap.tgz";
				writeFileSync(
					path.join(destination, filename),
					Buffer.from("intended packed package bytes")
				);
				return JSON.stringify([
					{ name: manifest.name, version: manifest.version, filename },
				]);
			}
			assert.equal(args[0], "publish");
			assert.deepEqual(args.slice(2), [
				"--ignore-scripts",
				"--access",
				"public",
				"--provenance",
				"--registry",
				registry,
			]);
			assert.equal(path.dirname(args[1]), state.packs.at(-1));
			state.publishes.push(args[1]);
			if (state.publishFailure) throw new Error("fixture npm publish failed");
			// This is NOT npm publish. Only this in-process loopback fixture receives bytes.
			const response = await fetch(`${origin}/registry/publish`, {
				method: "PUT",
				body: readFileSync(args[1]),
			});
			assert.equal(response.status, 201);
			return "";
		},
	};
	return {
		state,
		options,
		expectedRelease,
		async close() {
			await new Promise((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			);
			rmSync(directory, { recursive: true, force: true });
		},
	};
}
