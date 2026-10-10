import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { settingsSchema } from "./schema.js";

export const load = async () => {
	return {
		form: await superValidate(zod(settingsSchema)),
	};
};

export const actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod(settingsSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		return { form };
	},
};
