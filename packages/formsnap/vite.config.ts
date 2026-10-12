import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		sveltekit({
			experimental: { remoteFunctions: true },
			// SvelteKit 3 removed the implicit `$lib` alias. Keeping it is the documented escape hatch
			// (`https://svelte.dev/e/kit/module_removed_lib`); migrating the published `src/lib` to
			// `#lib` subpath imports would change the packaged output, so that is deferred.
			alias: {
				$lib: "src/lib",
				// Fixture recipes import the published package name; resolving it to source keeps the
				// checks independent of a prior `dist` build.
				"@emmorts/formsnap": "./src/lib/index.ts",
			},
		}),
	],
	test: {
		name: "unit",
		include: ["src/**/*.{test,spec}.{js,ts}", "tests/**/*.ssr.test.ts"],
		globalSetup: ["tests/dev-server.ts"],
		// HTTP rendering and real-app hydration include Vite's cold transforms.
		testTimeout: 30000,
		hookTimeout: 60000,
	},
});
