/**
 * Module aliases shared by the Formsnap Vitest projects.
 *
 * SvelteKit 3 removed the implicit `$lib` alias. Keeping it is the documented escape hatch
 * (`https://svelte.dev/e/kit/module_removed_lib`); migrating the published `src/lib` to `#lib`
 * subpath imports would change the packaged output, so that is deferred.
 *
 * Each Vitest project builds its own module graph, so every project has to be given the aliases:
 * the unit project rendered fine while the browser project could not resolve `$lib` at all.
 */
export const aliases = {
	$lib: "src/lib",
	// Longer keys first: a string alias matches as a prefix, so `@emmorts/formsnap/remote` has to be
	// resolved before `@emmorts/formsnap` would swallow it.
	"@emmorts/formsnap/remote": "./src/lib/remote/index.ts",
	// Fixture recipes import the published package name; resolving it to source keeps the checks
	// independent of a prior `dist` build.
	"@emmorts/formsnap": "./src/lib/index.ts",
};
