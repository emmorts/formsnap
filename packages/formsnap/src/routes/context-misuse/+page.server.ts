import type { PageServerLoad } from "./$types.js";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { reactivityData, reactivitySchema } from "../../../tests/fixtures/reactivity-schema.js";

export const csr = false;
export const load = (async ({ url }) => ({
	kind: url.searchParams.get("kind") ?? "description",
	form: await superValidate(reactivityData, zod(reactivitySchema)),
})) satisfies PageServerLoad;
