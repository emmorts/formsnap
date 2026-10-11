import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { publishRelease } from "./publish-release.mjs";
import { releaseFixture } from "./publish-release.fixture.mjs";

async function fixture(t) {
	const local = await releaseFixture();
	t.after(async () => {
		for (const directory of local.state.packs)
			assert.equal(existsSync(directory), false, "ephemeral pack must be removed");
		await local.close();
	});
	return local;
}

function noMutation(state) {
	assert.equal(state.publishes.length, 0);
	assert.equal(state.creates, 0);
	assert.equal(
		state.requests.some(({ method }) => method !== "GET"),
		false
	);
}

function matchingArtifact(state) {
	state.artifact = Buffer.from("intended packed package bytes");
}

test("absent exact npm version publishes the packed tarball once and completes the public release", async (t) => {
	const { state, options, expectedRelease } = await fixture(t);
	assert.deepEqual(await publishRelease(options), { npm: "published", github: "created" });
	assert.equal(state.packs.length, 1);
	assert.equal(state.publishes.length, 1);
	assert.equal(state.creates, 1);
	assert.equal(state.artifact.toString(), "intended packed package bytes");
	assert.deepEqual(state.release, expectedRelease);
	const mutation = state.requests.findIndex(({ method }) => method === "PUT");
	assert.ok(
		state.requests.slice(0, mutation).some(({ url }) => url.includes("git/ref/tags/")),
		"tag is verified before mutation"
	);
	assert.ok(
		state.requests.slice(0, mutation).some(({ url }) => url.includes("releases/tags/")),
		"GitHub is preflighted before publication"
	);
});

test("matching published bytes skip npm and create the missing GitHub release", async (t) => {
	const { state, options, expectedRelease } = await fixture(t);
	matchingArtifact(state);
	assert.deepEqual(await publishRelease(options), { npm: "verified", github: "created" });
	assert.equal(state.publishes.length, 0);
	assert.equal(state.creates, 1);
	assert.deepEqual(state.release, expectedRelease);
	assert.ok(
		state.requests.some(({ url }) => url.endsWith("artifact.tgz")),
		"download actual published artifact"
	);
});

test("a completed rerun verifies both artifacts without duplicate publication or release", async (t) => {
	const { state, options } = await fixture(t);
	await publishRelease(options);
	assert.deepEqual(await publishRelease(options), { npm: "verified", github: "verified" });
	assert.equal(state.packs.length, 2, "exactly one pack per attempt");
	assert.equal(state.publishes.length, 1);
	assert.equal(state.creates, 1);
});

test("mismatching published bytes fail before any remote mutation", async (t) => {
	const { state, options } = await fixture(t);
	state.artifact = Buffer.from("different published content");
	await assert.rejects(publishRelease(options), /published npm artifact does not match/);
	noMutation(state);
});

for (const status of [401, 403, 429, 500, 503]) {
	test(`npm HTTP ${status} is not treated as absent and causes no mutation`, async (t) => {
		const { state, options } = await fixture(t);
		state.versionStatus = status;
		await assert.rejects(
			publishRelease(options),
			new RegExp(`HTTP ${status}; absence is not established`)
		);
		noMutation(state);
	});
}

test("an unavailable registry fails without publication or release", async (t) => {
	const { state, options } = await fixture(t);
	state.versionDisconnect = true;
	await assert.rejects(publishRelease(options), /npm version lookup request failed/);
	noMutation(state);
});

for (const status of [401, 403, 503]) {
	test(`artifact download HTTP ${status} blocks mutation`, async (t) => {
		const { state, options } = await fixture(t);
		matchingArtifact(state);
		state.artifactStatus = status;
		await assert.rejects(
			publishRelease(options),
			new RegExp(`artifact download returned HTTP ${status}`)
		);
		noMutation(state);
	});
}

test("GitHub tag absence blocks publication instead of creating a new tag", async (t) => {
	const { state, options } = await fixture(t);
	state.tagStatus = 404;
	await assert.rejects(publishRelease(options), /GitHub tag lookup returned HTTP 404/);
	noMutation(state);
});

for (const status of [401, 403, 503]) {
	test(`GitHub lookup HTTP ${status} blocks publication`, async (t) => {
		const { state, options } = await fixture(t);
		state.lookupStatus = status;
		await assert.rejects(
			publishRelease(options),
			new RegExp(`GitHub release lookup returned HTTP ${status}`)
		);
		noMutation(state);
	});
}

for (const change of [
	{ body: "Different notes" },
	{ name: "Different title" },
	{ draft: true },
	{ prerelease: true },
	{ tag_name: "v0.0.0" },
]) {
	test(`an existing incompatible GitHub release is never overwritten: ${Object.keys(change)[0]}`, async (t) => {
		const { state, options, expectedRelease } = await fixture(t);
		state.release = { ...expectedRelease, ...change };
		await assert.rejects(publishRelease(options), /existing GitHub release does not match/);
		noMutation(state);
		assert.deepEqual(state.release, { ...expectedRelease, ...change });
	});
}

test("npm publication failure stops before GitHub release creation", async (t) => {
	const { state, options } = await fixture(t);
	state.publishFailure = true;
	await assert.rejects(publishRelease(options), /npm publish failed/);
	assert.equal(state.creates, 0);
	assert.equal(state.artifact, null);
	assert.equal(state.release, null);
});

test("failure after publication is reported and a rerun completes only the missing release", async (t) => {
	const { state, options, expectedRelease } = await fixture(t);
	state.createStatus = 503;
	await assert.rejects(publishRelease(options), /GitHub release creation returned HTTP 503/);
	assert.equal(state.publishes.length, 1);
	assert.ok(state.artifact);
	assert.equal(state.release, null);
	state.createStatus = 201;
	assert.deepEqual(await publishRelease(options), { npm: "verified", github: "created" });
	assert.equal(state.publishes.length, 1, "release-only rerun must never republish");
	assert.equal(state.creates, 2);
	assert.deepEqual(state.release, expectedRelease);
});

test("a concurrent matching GitHub release is accepted without an update", async (t) => {
	const { state, options, expectedRelease } = await fixture(t);
	matchingArtifact(state);
	state.createRace = true;
	await publishRelease(options);
	assert.equal(state.publishes.length, 0);
	assert.equal(state.creates, 1);
	assert.deepEqual(state.release, expectedRelease);
	assert.equal(state.requests.filter(({ url }) => url.includes("releases/tags/")).length, 2);
	assert.equal(
		state.requests.some(({ method }) => method === "PATCH"),
		false
	);
});

test("an unexplained GitHub 422 does not report release completion", async (t) => {
	const { state, options } = await fixture(t);
	matchingArtifact(state);
	state.createStatus = 422;
	await assert.rejects(
		publishRelease(options),
		/creation returned HTTP 422; recheck returned HTTP 404/
	);
	assert.equal(state.release, null);
	assert.equal(state.publishes.length, 0);
});

test("tag/version mismatch fails before packing or network access", async (t) => {
	const { state, options } = await fixture(t);
	await assert.rejects(publishRelease({ ...options, tag: "v0.0.0" }), /release tag must match/);
	assert.equal(state.packs.length, 0);
	assert.equal(state.requests.length, 0);
	noMutation(state);
});

for (const output of ["not JSON: fixture-token-never-print", "[]", "null"]) {
	test("invalid npm pack output fails closed and removes its temporary directory", async (t) => {
		const { state, options } = await fixture(t);
		let packDirectory;
		await assert.rejects(
			publishRelease({
				...options,
				run: async (args) => {
					assert.equal(args[0], "pack");
					packDirectory = args[args.indexOf("--pack-destination") + 1];
					return output;
				},
			}),
			/npm pack failed or returned invalid package metadata|npm pack did not produce/
		);
		assert.equal(existsSync(packDirectory), false);
		assert.equal(state.requests.length, 0);
		noMutation(state);
	});
}
