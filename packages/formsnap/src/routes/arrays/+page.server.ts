import { fail } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
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
		return form.valid ? message(form, "URLs saved.") : fail(400, { form });
	},
};
