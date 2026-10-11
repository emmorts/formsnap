import type { PageServerLoad } from "./$types.js";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { reactivityData, reactivitySchema } from "../../../tests/fixtures/reactivity-schema.js";

export const load = (async ({ url }) => ({
	headless: url.searchParams.get("headless") === "true",
	form: await superValidate(reactivityData, zod(reactivitySchema)),
})) satisfies PageServerLoad;
