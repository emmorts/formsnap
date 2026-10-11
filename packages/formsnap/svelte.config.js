import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [vitePreprocess({})],
	kit: {
		// Portable recipes use the public import; fixture checks must not depend on a prior dist build.
		alias: { "@emmorts/formsnap": "./src/lib/index.ts" },
	},
};

export default config;
