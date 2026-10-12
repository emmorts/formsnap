import { sveltekit } from "@sveltejs/kit/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

/**
 * Browser project: runs the consumer fixture in Chromium, so component lifecycle, effects and
 * DOM state after updates are observed in a real browser rather than a simulated one.
 */
export default defineConfig({
	plugins: [sveltekit()],
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
