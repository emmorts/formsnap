import { createServer as createTcpServer } from "node:net";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import type { GlobalSetupContext } from "vitest/node";
import type {} from "./fixture-url.js";

/** Select a free port; strictPort never silently redirects tests to a different application. */
export async function setup({ provide }: GlobalSetupContext) {
	// Vite 5 treats port 0 as its default port, so ask the OS for a port before configuring Vite.
	const reservation = createTcpServer();
	await new Promise<void>((resolve, reject) => {
		reservation.once("error", reject);
		reservation.listen(0, "127.0.0.1", resolve);
	});
	let port: number;
	try {
		const address = reservation.address();
		if (!address || typeof address === "string") {
			throw new Error("Could not allocate a fixture port.");
		}
		port = address.port;
	} finally {
		await new Promise<void>((resolve, reject) => {
			reservation.close((error) => (error ? reject(error) : resolve()));
		});
	}
	const server = await createServer({
		// Component-test optimization must never overwrite the real application's Svelte runtime.
		cacheDir: fileURLToPath(new URL("../node_modules/.vite-consumer", import.meta.url)),
		configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
		server: { host: "127.0.0.1", port, strictPort: true },
	});

	try {
		await server.listen();
		const address = server.httpServer?.address();
		if (!address || typeof address === "string") {
			throw new Error("The consumer fixture did not bind an HTTP port.");
		}
		const url = `http://127.0.0.1:${address.port}/`;
		for (const route of [
			"",
			"arrays",
			"json",
			"owned",
			"recipes",
			"recipes/upload",
			"recipes/constraints",
			"recipes/composition",
			"recipes/feedback",
			"recipes/announcements",
		]) {
			const response = await fetch(new URL(route, url), {
				signal: AbortSignal.timeout(30000),
			});
			const html = await response.text();
			if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
				throw new Error(`Fixture warmup failed for /${route}: ${response.status}\n${html}`);
			}
		}
		provide("fixtureUrl", url);
	} catch (error) {
		await server.close();
		throw error;
	}

	return async () => {
		await server.close();
	};
}
