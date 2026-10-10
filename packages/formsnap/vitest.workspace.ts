import { defineWorkspace } from "vitest/config";

/**
 * Two projects: `unit` (Node, including the server-rendered fixture) and `browser` (Chromium).
 */
export default defineWorkspace(["./vite.config.ts", "./vitest.browser.config.ts"]);
