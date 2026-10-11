import { fork } from "node:child_process";
import { once } from "node:events";
import { createServer as createTcpServer } from "node:net";
import { fileURLToPath } from "node:url";
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
	// Keep the real application's Vite SSR loader in a separate process from Vitest's loader.
	// Isolated optimizer caches alone do not isolate Vite 5's process-wide module state.
	const server = fork(
		fileURLToPath(new URL("./fixture-server.mjs", import.meta.url)),
		[String(port)],
		{
			cwd: fileURLToPath(new URL("../", import.meta.url)),
			stdio: ["ignore", "inherit", "inherit", "ipc"],
		}
	);
	const close = async () => {
		if (server.pid === undefined || server.exitCode !== null || server.signalCode !== null)
			return;
		const exited = once(server, "exit");
		const deadline = setTimeout(() => server.kill("SIGKILL"), 5000);
		server.kill("SIGTERM");
		try {
			const [code, signal] = await exited;
			if (code !== 0) throw new Error(`The consumer fixture stopped with ${signal ?? code}.`);
		} finally {
			clearTimeout(deadline);
		}
	};

	try {
		await new Promise<void>((resolve, reject) => {
			const finish = (error?: Error) => {
				clearTimeout(deadline);
				server.off("message", onMessage);
				server.off("exit", onExit);
				server.off("error", finish);
				if (error) reject(error);
				else resolve();
			};
			const onMessage = (message: unknown) =>
				finish(
					message === "ready"
						? undefined
						: new Error("Unexpected fixture startup message.")
				);
			const onExit = () => finish(new Error("The consumer fixture exited before listening."));
			const deadline = setTimeout(
				() => finish(new Error("The consumer fixture did not start within 30 seconds.")),
				30000
			);
			server.once("message", onMessage);
			server.once("exit", onExit);
			server.once("error", finish);
		});
		const url = `http://127.0.0.1:${port}/`;
		for (const route of [
			"",
			"arrays",
			"json",
			"owned",
			"recipes",
			"recipes/upload",
			"recipes/constraints",
			"recipes/composition",
			"recipes/groups",
			"recipes/widgets",
			"recipes/feedback",
			"recipes/announcements",
			"recipes/errors",
			"label-identity",
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
		await close();
		throw error;
	}

	return close;
}
