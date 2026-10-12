import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const libDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every static `from "…"` / `import "…"` specifier, which is all this layer is allowed to use. */
function specifiersOf(source: string): string[] {
	return [...source.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)].map((match) => match[1]);
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
 * The presentation layer exists so a backend that is not Superforms can reuse association and
 * control presentation. That only holds while the layer never reaches a Superforms module, so this
 * walks its import closure from `presentation.svelte.ts` and fails on any specifier naming
 * `sveltekit-superforms`, plus on a specifier it cannot resolve (which would silently truncate the
 * walk rather than prove anything).
 */
describe("presentation boundary", () => {
	it("resolves the whole presentation closure without reaching Superforms", () => {
		const queue = [resolve(libDir, "internal/presentation.svelte.ts")];
		const visited = new Set<string>();
		const superformsImports: string[] = [];
		const unresolvedImports: string[] = [];

		while (queue.length) {
			const file = queue.pop();
			if (file === undefined || visited.has(file)) continue;
			visited.add(file);

			for (const specifier of specifiersOf(readFileSync(file, "utf8"))) {
				if (
					specifier === "sveltekit-superforms" ||
					specifier.startsWith("sveltekit-superforms/")
				) {
					superformsImports.push(`${relative(libDir, file)} imports ${specifier}`);
					continue;
				}
				// Package specifiers other than Superforms are resolved by the bundler, not by us.
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
		for (const expected of [
			"internal/presentation.svelte.ts",
			"attrs.types.ts",
			"internal/context.ts",
			"internal/utils/attributes.ts",
		]) {
			expect([...visited].map((file) => relative(libDir, file))).toContain(expected);
		}
	});

	it("still reaches Superforms from the owner module", () => {
		// The counterpart guarantee: the split is real rather than the dependency disappearing.
		expect(specifiersOf(readFileSync(resolve(libDir, "formsnap.svelte.ts"), "utf8"))).toContain(
			"sveltekit-superforms"
		);
	});
});
