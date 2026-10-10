import { createServer, type ViteDevServer } from "vite";

/**
 * The fixture app is served on a fixed port so server-rendered assertions fetch a deterministic
 * URL. `strictPort` makes a conflicting process fail loudly instead of silently serving elsewhere.
 */
export const DEV_SERVER_PORT = 5199;
export const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}/`;

let server: ViteDevServer | undefined;

/** Vitest global setup: boots the fixture app so tests can request server-rendered HTML. */
export async function setup() {
	server = await createServer({
		configFile: "./vite.config.ts",
		server: { port: DEV_SERVER_PORT, strictPort: true },
	});
	await server.listen();
}

/** Vitest global teardown: releases the port even when tests fail. */
export async function teardown() {
	await server?.close();
}
