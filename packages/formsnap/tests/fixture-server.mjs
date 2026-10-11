import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
const close = async () => {
	try {
		await server?.close();
		process.exit(0);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
};
process.once("SIGTERM", close);
process.once("SIGINT", close);

try {
	const port = Number(process.argv[2]);
	server = await createServer({
		// The browser component project must not replace the real application's Svelte runtime.
		cacheDir: fileURLToPath(new URL("../node_modules/.vite-consumer", import.meta.url)),
		configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
		server: { host: "127.0.0.1", port, strictPort: true },
	});
	await server.listen();
	const address = server.httpServer?.address();
	if (!address || typeof address === "string" || address.port !== port) {
		throw new Error("The consumer fixture did not bind its reserved HTTP port.");
	}
	process.send("ready");
} catch (error) {
	console.error(error);
	await server?.close();
	process.exit(1);
}
