import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const libDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Statements whose only specifiers are types. They are erased before the module runs, so they are not
 * a runtime dependency; `import { type X, Y }` is treated as a value import unless every specifier is
 * a type.
 */
function valueSpecifiersOf(source: string): string[] {
	const specifiers: string[] = [];

	for (const match of source.matchAll(
		/\b(?:import|export)\s+([^;]*?)\bfrom\s*["']([^"']+)["']/g
	)) {
		const clause = match[1];
		const specifier = match[2];
		if (clause.trimStart().startsWith("type ")) continue;
		const braces = clause.match(/\{([^}]*)\}/);
		if (braces && braces[1].split(",").every((entry) => entry.trim().startsWith("type "))) {
			continue;
		}
		specifiers.push(specifier);
	}

	// A bare `import "x"` has no clause and always runs.
	for (const match of source.matchAll(/\bimport\s*["']([^"']+)["']/g)) {
		specifiers.push(match[1]);
	}

	return specifiers;
}

/** Resolves a relative or `$lib` specifier to a file, accepting the `.js`-for-`.ts` convention. */
function resolveFile(from: string, specifier: string): string | undefined {
	const base = specifier.startsWith("$lib/")
		? resolve(libDir, specifier.slice("$lib/".length))
		: resolve(dirname(from), specifier);

	return [
		base,
		base.replace(/\.js$/, ".ts"),
		`${base}.ts`,
		`${base}.svelte.ts`,
		`${base}.svelte`,
		resolve(base, "index.ts"),
	].find((candidate) => existsSync(candidate));
}

/**
 * The remote entry point is the one a consumer of a native Kit remote form imports. Its guarantee is
 * that it pulls in no Superforms code at runtime: a remote-only consumer never loads it, and nothing
 * here fabricates a `SuperForm`. `import type` references to Superforms-typed props are erased, so
 * they do not count; a value import would, and so would a specifier the walk cannot resolve, which
 * would silently truncate the check.
 */
describe("remote entry boundary", () => {
	it("reaches no Superforms code through value imports", () => {
		const queue = [resolve(libDir, "remote/index.ts")];
		const visited = new Set<string>();
		const superformsImports: string[] = [];
		const unresolvedImports: string[] = [];

		while (queue.length) {
			const file = queue.pop();
			if (file === undefined || visited.has(file)) continue;
			visited.add(file);

			for (const specifier of valueSpecifiersOf(readFileSync(file, "utf8"))) {
				if (
					specifier === "sveltekit-superforms" ||
					specifier.startsWith("sveltekit-superforms/")
				) {
					superformsImports.push(`${relative(libDir, file)} imports ${specifier}`);
					continue;
				}
				if (!specifier.startsWith(".") && !specifier.startsWith("$lib/")) continue;

				const target = resolveFile(file, specifier);
				if (target === undefined) {
					unresolvedImports.push(`${relative(libDir, file)} imports ${specifier}`);
					continue;
				}
				queue.push(target);
			}
		}

		expect(superformsImports).toEqual([]);
		expect(unresolvedImports).toEqual([]);
		// Guards against the walk passing because it followed nothing.
		const reached = [...visited].map((file) => relative(libDir, file));
		for (const expected of [
			"remote/index.ts",
			"remote/RemoteField.svelte",
			"remote/RemoteControl.svelte",
			"remote/RemoteFieldset.svelte",
			"remote/remote-field.svelte.ts",
			"internal/presentation.svelte.ts",
			"components/label.svelte",
			"components/field-errors.svelte",
		]) {
			expect(reached).toContain(expected);
		}
	});

	it("keeps the Superforms-only components out of the remote entry", () => {
		// The remote entry presents a remote field with RemoteControl; Control reads a name that a Kit
		// field leaves to its transport, and Field/Fieldset take a Superform, so none of them may be
		// reachable from here. Compared as whole specifiers: `./remote-field.svelte.js` merely contains
		// the substring.
		const reached = valueSpecifiersOf(readFileSync(resolve(libDir, "remote/index.ts"), "utf8"));
		for (const forbidden of [
			"$lib/components/control.svelte",
			"$lib/components/field.svelte",
			"$lib/components/fieldset.svelte",
			"$lib/components/element-field.svelte",
		]) {
			expect(reached).not.toContain(forbidden);
		}
	});
});

/** Every static specifier, whether it is imported as a value or a type. */
function allSpecifiersOf(source: string): string[] {
	return [...source.matchAll(/\b(?:import|export)\s+[^;]*?\bfrom\s*["']([^"']+)["']/g)].map(
		(match) => match[1]
	);
}

/**
 * Specifiers an emitted declaration can carry. A component's value imports are erased before its
 * `.d.ts` is written, so only its type-only clauses are followed; a module file is followed in full
 * because its declarations keep its own `import` and `export` statements. `import type { A } from`,
 * `import type A from` and `export type * from` count, and so does a named clause whose entries are
 * all `type` prefixed.
 */
function typeSpecifiersOf(source: string): string[] {
	const specifiers: string[] = [];

	for (const match of source.matchAll(
		/\b(?:import|export)\s+([^;]*?)\bfrom\s*["']([^"']+)["']/g
	)) {
		const clause = match[1].trimStart();
		if (clause.startsWith("type ")) {
			specifiers.push(match[2]);
			continue;
		}
		const braces = clause.match(/\{([^}]*)\}/);
		const entries = braces?.[1].split(",").filter((entry) => entry.trim());
		if (entries?.length && entries.every((entry) => entry.trim().startsWith("type "))) {
			specifiers.push(match[2]);
		}
	}

	return specifiers;
}

/**
 * The declaration half of the remote entry's isolation.
 *
 * `remote-boundary.test.ts` proves the runtime closure is free of Superforms, which a remote-only
 * consumer never loads. Its published `.d.ts` files are the other half: they are what `tsc` resolves
 * during that consumer's type-check, and a `sveltekit-superforms` import anywhere in their closure
 * makes an installation without Superforms fail to type-check even though nothing Superforms-shaped
 * is published. This walks that closure and fails if it reaches the Superforms-typed modules — the
 * path lookup and the `Field`/`Fieldset`/`ElementField` props — or any specifier it cannot resolve.
 *
 * The walk is wider than the emitted graph, not narrower: it follows module files whole, and it
 * follows a component's type-only clauses rather than only the types that end up referenced. An
 * inline `import("sveltekit-superforms")` in an emitted declaration cannot hide from it either,
 * because that form only appears in the artifact check, which reads the built files.
 */
describe("remote declaration boundary", () => {
	it("reaches no Superforms declarations through the types it publishes", () => {
		const queue = [resolve(libDir, "remote/index.ts")];
		const visited = new Set<string>();
		const superformsImports: string[] = [];
		const unresolvedImports: string[] = [];

		while (queue.length) {
			const file = queue.pop();
			if (file === undefined || visited.has(file)) continue;
			visited.add(file);

			const source = readFileSync(file, "utf8");
			const specifiers = file.endsWith(".svelte")
				? typeSpecifiersOf(source)
				: allSpecifiersOf(source);

			for (const specifier of specifiers) {
				if (
					specifier === "sveltekit-superforms" ||
					specifier.startsWith("sveltekit-superforms/")
				) {
					superformsImports.push(`${relative(libDir, file)} imports ${specifier}`);
					continue;
				}
				if (!specifier.startsWith(".") && !specifier.startsWith("$lib/")) continue;

				const target = resolveFile(file, specifier);
				if (target === undefined) {
					unresolvedImports.push(`${relative(libDir, file)} imports ${specifier}`);
					continue;
				}
				queue.push(target);
			}
		}

		expect(superformsImports).toEqual([]);
		expect(unresolvedImports).toEqual([]);

		// The property is that the Superforms-typed modules are absent, not merely that the walk
		// stopped short: these are the modules that declare the props the components use.
		const reached = [...visited].map((file) => relative(libDir, file));
		for (const expected of [
			"remote/index.ts",
			"remote/types.ts",
			"remote/RemoteField.svelte",
			"remote/RemoteFieldset.svelte",
			"remote/RemoteControl.svelte",
			"remote/remote-field.svelte.ts",
			"internal/presentation.svelte.ts",
			"internal/types.ts",
			"attrs.types.ts",
			"components/presentation-types.ts",
			"components/label.svelte",
			"components/description.svelte",
			"components/legend.svelte",
			"components/field-errors.svelte",
		]) {
			expect(reached).toContain(expected);
		}
		for (const forbidden of [
			"components/types.ts",
			"internal/form-path.ts",
			"formsnap.svelte.ts",
			"internal/utils/errors.ts",
		]) {
			expect(reached).not.toContain(forbidden);
		}
	});
});
