import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { urlsSchema } from "./schema.js";

export const load = async () => ({
	form: await superValidate(
		{ urls: ["https://a.example", "https://b.example"] },
		zod(urlsSchema)
	),
});

export const actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod(urlsSchema));
		return form.valid ? { form } : fail(400, { form });
	},
};
