import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		name: "unit",
		include: ["src/**/*.{test,spec}.{js,ts}", "tests/**/*.ssr.test.ts"],
		globalSetup: ["tests/dev-server.ts"],
		// HTTP rendering and real-app hydration include Vite's cold transforms.
		testTimeout: 30000,
		hookTimeout: 60000,
	},
});
