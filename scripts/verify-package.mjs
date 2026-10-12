#!/usr/bin/env node
// Packages @emmorts/formsnap and proves the artifact from outside the workspace.
//
//   node scripts/verify-package.mjs [--svelte=<version>] [--kit=<version>] [--keep]
//
// It requires a fresh `pnpm --filter @emmorts/formsnap run package` output (a local `dist/` is not
// evidence by itself), then:
//
//   1. reads the built declaration graph of `dist/remote` and fails on a Superforms reference,
//   2. packs the tarball and checks what it contains and what it must not,
//   3. installs it into a clean consumer that has no Superforms, type-checks the published entry
//      points, and runs that consumer's own SvelteKit app to render and submit a native remote
//      form through the installed package,
//   4. installs it into a clean Superforms consumer and type-checks the root entry's contract.
//
// The consumer directories are temporary and external to this workspace: nothing resolves a
// workspace alias, so what is exercised is the packed tarball.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkgDir = path.join(root, "packages/formsnap");
const distDir = path.join(pkgDir, "dist");

const args = new Map(
	process.argv
		.slice(2)
		.filter((arg) => arg.startsWith("--"))
		.map((arg) => {
			const [name, value] = arg.slice(2).split("=");
			return [name, value ?? "true"];
		})
);
const keep = args.has("keep");

const failures = [];
const scratch = [];

function pass(message) {
	console.log(`ok    ${message}`);
}

function fail(message, detail) {
	failures.push(detail === undefined ? message : `${message}\n${detail}`);
	console.log(`FAIL  ${message}`);
	if (detail !== undefined) console.log(detail);
}

function check(condition, message, detail) {
	if (condition) pass(message);
	else fail(message, detail);
	return condition;
}

function run(command, commandArgs, options = {}) {
	const result = spawnSync(command, commandArgs, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		...options,
	});
	if (result.status !== 0) {
		throw new Error(
			`${command} ${commandArgs.join(" ")} exited with ${result.status}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`
		);
	}
	return result.stdout ?? "";
}

function git(...gitArgs) {
	return run("git", gitArgs, { cwd: root }).trim();
}

function installedVersion(name) {
	for (const base of [path.join(pkgDir, "node_modules"), path.join(root, "node_modules")]) {
		const manifest = path.join(base, name, "package.json");
		if (existsSync(manifest)) return JSON.parse(readFileSync(manifest, "utf8")).version;
	}
	throw new Error(`cannot find the installed version of ${name}`);
}

function version(name, flag = name) {
	return args.get(flag) ?? installedVersion(name);
}

/** A temporary directory that is removed at the end unless it is being kept for inspection. */
function temporaryDirectory(label) {
	const directory = mkdtempSync(path.join(tmpdir(), `formsnap-${label}-`));
	scratch.push(directory);
	return directory;
}

function writeFiles(directory, files) {
	for (const [relative, contents] of Object.entries(files)) {
		const target = path.join(directory, relative);
		mkdirSync(path.dirname(target), { recursive: true });
		writeFileSync(target, contents);
	}
}

/** An ephemeral port, released just before the caller binds it. */
async function freePort() {
	const reservation = createServer();
	await new Promise((resolve, reject) => {
		reservation.once("error", reject);
		reservation.listen(0, "127.0.0.1", resolve);
	});
	const address = reservation.address();
	const port = typeof address === "object" && address !== null ? address.port : 0;
	await new Promise((resolve, reject) =>
		reservation.close((error) => (error ? reject(error) : resolve()))
	);
	if (port === 0) throw new Error("could not reserve a port");
	return port;
}

// ---------------------------------------------------------------------------------------------
// 1. The built declaration graph of the remote entry
// ---------------------------------------------------------------------------------------------

/**
 * The `.d.ts` files a consumer of `dist/remote/index.d.ts` resolves, following both `from "…"` and
 * inline `import("…")` references, because either form makes a consumer resolve the target.
 */
function declarationClosure(entry) {
	const queue = [entry];
	const files = new Set();
	const superforms = [];
	const unresolved = [];

	while (queue.length) {
		const file = queue.pop();
		if (file === undefined || files.has(file)) continue;
		files.add(file);

		const source = readFileSync(file, "utf8");
		const specifiers = [
			...source.matchAll(/\bfrom\s*"([^"]+)"/g),
			...source.matchAll(/\bimport\(\s*"([^"]+)"\s*\)/g),
		].map((match) => match[1]);

		for (const specifier of specifiers) {
			if (
				specifier === "sveltekit-superforms" ||
				specifier.startsWith("sveltekit-superforms/")
			) {
				superforms.push(`${path.relative(distDir, file)} -> ${specifier}`);
				continue;
			}
			if (!specifier.startsWith(".")) continue;

			// Every relative import inside a declaration has to resolve to another declaration, so a
			// target that is only a raw `.js` or `.svelte` file is reported rather than followed.
			const base = path.resolve(path.dirname(file), specifier);
			const target = [
				`${base}.d.ts`,
				base.replace(/\.js$/, ".d.ts"),
				path.join(base, "index.d.ts"),
			].find((candidate) => existsSync(candidate));
			if (target === undefined) {
				unresolved.push(`${path.relative(distDir, file)} -> ${specifier}`);
				continue;
			}
			queue.push(target);
		}
	}

	return { files, superforms, unresolved };
}

/**
 * The modules a bundler would load from an entry point: relative specifiers resolved to the file
 * that ships, with `.js` for compiled modules and the `.svelte` source for components.
 */
function runtimeClosure(entry) {
	const queue = [entry];
	const files = new Set();

	while (queue.length) {
		const file = queue.pop();
		if (file === undefined || files.has(file)) continue;
		files.add(file);

		const source = readFileSync(file, "utf8");
		const specifiers = [
			...source.matchAll(/\bfrom\s*"([^"]+)"/g),
			...source.matchAll(/\bimport\s*"([^"]+)"/g),
			...source.matchAll(/\bimport\(\s*"([^"]+)"\s*\)/g),
		].map((match) => match[1]);

		for (const specifier of specifiers) {
			if (!specifier.startsWith(".")) continue;

			const base = path.resolve(path.dirname(file), specifier);
			const target = [base, `${base}.js`, path.join(base, "index.js")].find((candidate) =>
				existsSync(candidate)
			);
			if (target !== undefined) queue.push(target);
		}
	}

	return files;
}

function checkDist() {
	const required = [
		"index.js",
		"index.d.ts",
		"remote/index.js",
		"remote/index.d.ts",
		"components/presentation-types.d.ts",
	];
	const missing = required.filter((relative) => !existsSync(path.join(distDir, relative)));
	if (
		!check(
			missing.length === 0,
			"dist contains both entry points",
			missing.length ? `missing: ${missing.join(", ")}` : undefined
		)
	) {
		throw new Error(
			"run `pnpm --filter @emmorts/formsnap run package` for a fresh dist before this script"
		);
	}

	const closure = declarationClosure(path.join(distDir, "remote/index.d.ts"));
	const reached = [...closure.files].map((file) => path.relative(distDir, file));

	check(
		closure.superforms.length === 0,
		"the remote declaration graph reaches no Superforms declaration",
		closure.superforms.join("\n")
	);
	check(
		closure.unresolved.length === 0,
		"the remote declaration graph resolves every relative import",
		closure.unresolved.join("\n")
	);
	check(
		!reached.some(
			(file) => file === "components/types.d.ts" || file === "internal/form-path.d.ts"
		),
		"the Superforms-typed prop and path modules are absent from it",
		reached.filter((file) => /types\.d\.ts$|form-path\.d\.ts$/.test(file)).join("\n")
	);
	check(
		reached.includes("components/presentation-types.d.ts"),
		"the shared presentation props are in it",
		reached.join("\n")
	);

	// The walk has to be able to see a Superforms dependency at all, or the check above would pass
	// for a graph it never read. The root entry does depend on Superforms, so it is the control.
	const rootClosure = declarationClosure(path.join(distDir, "index.d.ts"));
	check(
		rootClosure.superforms.length > 0,
		"the same walk reports the root entry's Superforms dependency",
		[...rootClosure.files].map((file) => path.relative(distDir, file)).join("\n")
	);

	// The split the two entries rest on: a Superforms consumer resolves no remote backend code, in
	// either the declarations or the modules a bundler would load.
	const rootFiles = [...rootClosure.files, ...runtimeClosure(path.join(distDir, "index.js"))].map(
		(file) => path.relative(distDir, file)
	);
	check(
		!rootFiles.some((file) => file.startsWith("remote/")),
		"the root entry reaches no remote entry code",
		rootFiles.filter((file) => file.startsWith("remote/")).join("\n")
	);
}

// ---------------------------------------------------------------------------------------------
// 2. The tarball
// ---------------------------------------------------------------------------------------------

function checkTarball() {
	const destination = temporaryDirectory("pack");
	const output = run(
		"npm",
		["pack", "--json", "--pack-destination", destination, "--ignore-scripts"],
		{ cwd: pkgDir }
	);
	const [packed] = JSON.parse(output);
	const tarball = path.join(destination, packed.filename);
	const entries = packed.files.map((file) => file.path.replace(/^package\//, ""));

	check(existsSync(tarball), `packed ${packed.filename}`, tarball);

	for (const required of [
		"package.json",
		"CHANGELOG.md",
		"dist/index.js",
		"dist/index.d.ts",
		"dist/remote/index.js",
		"dist/remote/index.d.ts",
	]) {
		if (!check(entries.includes(required), `tarball contains ${required}`)) {
			console.log(`      it contains: ${entries.slice(0, 20).join(", ")}`);
		}
	}

	const forbidden = [
		[/\.remote\.ts$/, "a server recipe module"],
		[/^src\//, "library source"],
		[/\.(test|spec)\./, "a test file"],
		[/^tests\//, "the test suite"],
		[/^docs\//, "documentation source"],
		[/remote-functions/, "a local working document"],
		[/implementation-plan/, "a local working document"],
	];
	for (const [pattern, description] of forbidden) {
		const found = entries.filter((entry) => pattern.test(entry));
		check(found.length === 0, `tarball ships no ${description}`, found.slice(0, 10).join("\n"));
	}

	return tarball;
}

// ---------------------------------------------------------------------------------------------
// 3. Consumer installs
// ---------------------------------------------------------------------------------------------

const consumerTsconfig = `${JSON.stringify(
	{
		compilerOptions: {
			strict: true,
			target: "esnext",
			module: "nodenext",
			moduleResolution: "nodenext",
			noEmit: true,
			// The consumer's own code is checked; third-party declarations are not (svelte-toolbelt,
			// Superforms and Kit each ship declarations that expect their own app's ambient types).
			// The declaration graph is checked directly instead, in checkDist.
			skipLibCheck: true,
			types: [],
		},
		include: ["check.ts"],
	},
	null,
	"\t"
)}\n`;

function install(directory, dependencies, devDependencies) {
	writeFiles(directory, {
		"package.json": `${JSON.stringify(
			{
				name: `formsnap-consumer-${path.basename(directory)}`,
				private: true,
				type: "module",
				dependencies,
				devDependencies,
			},
			null,
			"\t"
		)}\n`,
	});
	run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: directory });
}

function typeCheck(directory) {
	const result = spawnSync(
		path.join(directory, "node_modules/.bin/tsc"),
		["-p", path.join(directory, "tsconfig.json")],
		{ cwd: directory, encoding: "utf8" }
	);
	return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() };
}

/** The attributes of a rendered tag, read as written. */
function tagAttributes(tag) {
	const attributes = {};
	for (const match of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?/g)) {
		attributes[match[1]] = match[2];
	}
	return attributes;
}

/** The attributes of the first tag carrying a test id, whatever element it is. */
function tagWithTestId(html, testId) {
	for (const tag of html.matchAll(/<[a-z][-a-z0-9]*\b[^>]*>/gi)) {
		const attributes = tagAttributes(tag[0]);
		if (attributes["data-testid"] === testId) return attributes;
	}
	return undefined;
}

/** The attributes of the first tag of the given element. */
function firstTag(html, name) {
	const tag = html.match(new RegExp(`<${name}\\b[^>]*>`, "i"))?.[0];
	return tag === undefined ? undefined : tagAttributes(tag);
}

const consumer = {
	svelte: () => version("svelte"),
	"@sveltejs/kit": () => version("@sveltejs/kit", "kit"),
	"@sveltejs/vite-plugin-svelte": () => version("@sveltejs/vite-plugin-svelte"),
	vite: () => version("vite"),
	typescript: () => version("typescript"),
};

const remoteConsumerPage = `<script lang="ts">
	import { FieldErrors, Label, RemoteControl, RemoteField } from "@emmorts/formsnap/remote";
	import { save } from "./save.remote.js";

	const title = save.fields.title;
	const seats = save.fields.seats;
</script>

<h1>Packed consumer</h1>

<form {...save}>
	<RemoteField field={title} constraints={{ required: true }}>
		<RemoteControl id="consumer-title">
			{#snippet children({ props })}
				<Label>Consumer title</Label>
				<input data-testid="consumer-title" {...title.as("text")} {...props} />
			{/snippet}
		</RemoteControl>
		{#snippet description()}
			<span data-testid="consumer-title-description">At least three characters.</span>
		{/snippet}
		<FieldErrors />
	</RemoteField>

	<RemoteField field={seats}>
		<RemoteControl id="consumer-seats">
			{#snippet children({ props })}
				<Label>Seats</Label>
				<input data-testid="consumer-seats" {...seats.as("number", 1)} {...props} />
			{/snippet}
		</RemoteControl>
		<FieldErrors />
	</RemoteField>

	<button>Save</button>
</form>

{#if save.result}
	<output data-testid="consumer-result">{save.result.title}:{save.result.seats}</output>
{/if}
`;

const remoteConsumerHandler = `import { invalid } from "@sveltejs/kit";
import { form } from "$app/server";
import { z } from "zod";

const schema = z.object({
	title: z.string().min(3, "Title needs at least three characters."),
	seats: z.number().int().min(1).max(9),
});

export const save = form(schema, async (data, issue) => {
	if (data.title.trim().toLowerCase() === "reserved") {
		invalid(issue.title("That title is reserved."));
	}

	return { title: data.title, seats: data.seats };
});
`;

const remoteConsumerCheck = `import {
	Description,
	FieldErrors,
	Label,
	Legend,
	RemoteControl,
	RemoteField,
	RemoteFieldset,
	useRemoteFormField,
} from "@emmorts/formsnap/remote";
import type {
	RemoteControlProps,
	RemoteFieldLike,
	RemoteFieldProps,
	RemoteFieldsetProps,
	RemoteIssue,
} from "@emmorts/formsnap/remote";

type KitField = RemoteFieldLike & { value(): { title: string; seats: number } };

declare const field: KitField;

export const fieldProps: RemoteFieldProps<KitField> = { field, constraints: { required: true } };
// @ts-expect-error a remote field has no form prop; the published props must reject one
export const noFormProp: RemoteFieldProps<KitField> = { field, form: {} };
export const fieldsetProps: RemoteFieldsetProps<KitField> = { field, id: "group" };
export const controlProps: RemoteControlProps = {};
export const issue: RemoteIssue = { message: "too short", path: ["title"] };
export const components = [
	RemoteField,
	RemoteFieldset,
	RemoteControl,
	Label,
	Description,
	FieldErrors,
	Legend,
	useRemoteFormField,
];
`;

async function checkRemoteConsumer(tarball) {
	const directory = temporaryDirectory("remote-consumer");
	install(
		directory,
		{
			"@emmorts/formsnap": `file:${tarball}`,
			"@sveltejs/kit": consumer["@sveltejs/kit"](),
			svelte: consumer.svelte(),
			zod: version("zod"),
		},
		{
			"@sveltejs/vite-plugin-svelte": consumer["@sveltejs/vite-plugin-svelte"](),
			typescript: consumer.typescript(),
			vite: consumer.vite(),
		}
	);

	const { version: kitVersion } = JSON.parse(
		readFileSync(path.join(directory, "node_modules/@sveltejs/kit/package.json"), "utf8")
	);
	check(
		kitVersion === consumer["@sveltejs/kit"](),
		`the remote consumer installed @sveltejs/kit ${kitVersion}`
	);
	check(
		!existsSync(path.join(directory, "node_modules/sveltekit-superforms")),
		"the remote consumer has no Superforms installed"
	);

	writeFiles(directory, {
		"tsconfig.json": consumerTsconfig,
		"check.ts": remoteConsumerCheck,
		"src/app.html": `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		%sveltekit.head%
	</head>
	<body data-sveltekit-preload-data="hover">
		<div>%sveltekit.body%</div>
	</body>
</html>
`,
		"src/routes/+page.svelte": remoteConsumerPage,
		"src/routes/save.remote.ts": remoteConsumerHandler,
		"vite.config.ts": `import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [sveltekit({ experimental: { remoteFunctions: true } })],
});
`,
	});

	const types = typeCheck(directory);
	check(
		types.status === 0,
		"the remote-only installation type-checks against the published declarations",
		types.output.split("\n").slice(0, 20).join("\n")
	);

	await runRemoteConsumerApp(directory);
}

/** Renders the consumer's own app through the installed package and submits it natively. */
async function runRemoteConsumerApp(directory) {
	const port = await freePort();
	const origin = `http://127.0.0.1:${port}`;
	const server = spawn(
		path.join(directory, "node_modules/.bin/vite"),
		["dev", "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
		{
			cwd: directory,
			env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
			stdio: ["ignore", "pipe", "pipe"],
		}
	);
	let log = "";
	server.stdout.on("data", (chunk) => (log += chunk));
	server.stderr.on("data", (chunk) => (log += chunk));

	try {
		const deadline = Date.now() + 180_000;
		let ready = false;
		while (Date.now() < deadline && !ready) {
			if (server.exitCode !== null) break;
			try {
				const response = await fetch(origin, {
					headers: { accept: "text/html" },
					signal: AbortSignal.timeout(10_000),
				});
				ready = response.ok;
			} catch {
				ready = false;
			}
			if (!ready) await new Promise((resolve) => setTimeout(resolve, 1000));
		}
		if (!check(ready, "the consumer's SvelteKit app serves its route", log.slice(-4000)))
			return;

		const render = await fetch(origin, {
			headers: { accept: "text/html" },
			signal: AbortSignal.timeout(30_000),
		});
		const html = await render.text();

		check(html.includes("Consumer title"), "the installed package renders its label");
		const title = tagWithTestId(html, "consumer-title");
		const seats = tagWithTestId(html, "consumer-seats");
		check(title !== undefined, "the installed package renders the control");
		if (title === undefined || seats === undefined) return;

		check(
			typeof title.name === "string" && title.name.length > 0,
			"the control carries the transport name Kit generated",
			JSON.stringify(title)
		);
		const describedby = title["aria-describedby"];
		check(
			html.includes(`for="${title.id}"`),
			"the label is associated with the control from the server",
			title.id
		);
		check(
			typeof describedby === "string" &&
				describedby.length > 0 &&
				html.includes(`id="${describedby}"`) &&
				html.includes("At least three characters."),
			"the owned description is associated without JavaScript",
			`describedby=${describedby}`
		);

		// Kit renders the native submission target as a query parameter on the page URL, so a POST
		// that does not carry it is not a remote-form submission.
		const form = firstTag(html, "form");
		check(
			typeof form?.action === "string" && form.action.includes("/remote="),
			"the form carries the native submission action Kit renders",
			JSON.stringify(form)
		);
		if (typeof form?.action !== "string") return;
		const endpoint = new URL(form.action, origin);
		const preview = (body) => body.replace(/\s+/g, " ").slice(0, 300);

		const submit = async (values) => {
			const response = await fetch(endpoint, {
				method: "POST",
				headers: {
					accept: "text/html",
					"content-type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams(values).toString(),
				signal: AbortSignal.timeout(30_000),
			});
			return { status: response.status, html: await response.text() };
		};

		const rejected = await submit({ [title.name]: "ab", [seats.name]: "4" });
		check(
			rejected.status === 200 &&
				rejected.html.includes("Title needs at least three characters."),
			"a native submission reports the server schema issue through the rendered form",
			`status=${rejected.status} ${preview(rejected.html)}`
		);

		const reserved = await submit({ [title.name]: "reserved", [seats.name]: "4" });
		check(
			reserved.status === 200 && reserved.html.includes("That title is reserved."),
			"a native submission reports the handler's own issue",
			`status=${reserved.status} ${preview(reserved.html)}`
		);

		const accepted = await submit({ [title.name]: "Packed consumer", [seats.name]: "4" });
		check(
			accepted.status === 200 && accepted.html.includes("Packed consumer:4"),
			"an accepted native submission runs the handler through the installed package",
			`status=${accepted.status} ${preview(accepted.html)}`
		);
	} finally {
		server.kill("SIGTERM");
		const exited = new Promise((resolve) => server.once("exit", resolve));
		await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
		if (server.exitCode === null) server.kill("SIGKILL");
	}
}

const rootConsumerCheck = `import {
	Control,
	Description,
	ElementField,
	Field,
	FieldErrors,
	Fieldset,
	Label,
	Legend,
	useFormField,
} from "@emmorts/formsnap";
import type { FieldProps, FsSuperForm, UseFormFieldResult } from "@emmorts/formsnap";
import type { SuperForm } from "sveltekit-superforms";

type Data = { title: string; seats: number };

declare const form: SuperForm<Data>;

// The documented contract: the superForm return value goes straight to the components.
export const fieldProps: FieldProps<Data, "title"> = { form, name: "title" };
// @ts-expect-error "seat" is not a path of Data, so the published path types must reject it
export const unknownPath: FieldProps<Data, "seat"> = { form, name: "seat" };
export const headless: FsSuperForm<Data> = form;
export type Headless = UseFormFieldResult<Data, "title">;
export const components = [
	Field,
	ElementField,
	Control,
	Label,
	Description,
	FieldErrors,
	Fieldset,
	Legend,
	useFormField,
];
`;

function checkRootConsumer(tarball) {
	const directory = temporaryDirectory("superforms-consumer");
	install(
		directory,
		{
			"@emmorts/formsnap": `file:${tarball}`,
			"@sveltejs/kit": consumer["@sveltejs/kit"](),
			svelte: consumer.svelte(),
			"sveltekit-superforms": version("sveltekit-superforms"),
			zod: version("zod"),
		},
		{
			"@sveltejs/vite-plugin-svelte": consumer["@sveltejs/vite-plugin-svelte"](),
			typescript: consumer.typescript(),
			vite: consumer.vite(),
		}
	);

	writeFiles(directory, { "tsconfig.json": consumerTsconfig, "check.ts": rootConsumerCheck });

	const types = typeCheck(directory);
	check(
		types.status === 0,
		"the Superforms installation type-checks the root entry's documented contract",
		types.output.split("\n").slice(0, 20).join("\n")
	);
}

// ---------------------------------------------------------------------------------------------

async function main() {
	console.log(`repository  ${git("config", "--get", "remote.origin.url")}`);
	console.log(
		`commit      ${git("rev-parse", "HEAD")} (dirty: ${git("status", "--porcelain") ? "yes" : "no"})`
	);
	console.log(
		`versions    svelte ${consumer.svelte()}, @sveltejs/kit ${consumer["@sveltejs/kit"]()}, ` +
			`sveltekit-superforms ${version("sveltekit-superforms")}, zod ${version("zod")}, ` +
			`typescript ${consumer.typescript()}, vite ${consumer.vite()}`
	);
	console.log("");

	checkDist();
	const tarball = checkTarball();
	await checkRemoteConsumer(tarball);
	checkRootConsumer(tarball);

	if (failures.length > 0) {
		console.log(`\n${failures.length} check(s) failed.`);
		if (keep) console.log(`Artifacts kept in ${scratch.join(", ")}`);
		process.exitCode = 1;
		return;
	}

	console.log("\nAll checks passed.");
}

try {
	await main();
} finally {
	if (!keep && !process.exitCode) {
		for (const directory of scratch) rmSync(directory, { recursive: true, force: true });
	} else if (keep) {
		console.log(`Kept: ${scratch.join(", ")}`);
	}
}
