import { sveltekit } from "@sveltejs/kit/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { aliases } from "./vite.aliases.js";

/**
 * Browser project: runs the consumer fixture in Chromium, so component lifecycle, effects and
 * DOM state after updates are observed in a real browser rather than a simulated one.
 *
 * This project has its own module graph, so it needs the shared aliases too — without them the
 * fixtures fail to resolve `$lib` and never load.
 */
export default defineConfig({
	plugins: [sveltekit({ alias: aliases })],
	cacheDir: "node_modules/.vite-browser-tests",
	test: {
		name: "browser",
		include: ["tests/**/*.browser.test.ts"],
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			instances: [{ browser: "chromium" }],
			screenshotFailures: false,
		},
	},
});
