import { defineConfig } from "vitest/config";

/**
 * Vitest 5 configures projects in a single file; the former `vitest.workspace.ts` with
 * `defineWorkspace` no longer exists. `unit` runs the Node tests plus the server-rendered
 * fixture; `browser` runs the consumer fixture in Chromium.
 */
export default defineConfig({
	test: {
		projects: ["./vite.config.ts", "./vitest.browser.config.ts"],
	},
});
