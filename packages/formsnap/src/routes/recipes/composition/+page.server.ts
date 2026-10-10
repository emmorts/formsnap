import { fail } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { compositionSchema } from "./schema.js";

export const load = async () => ({
	// No data: `rating` takes its schema default, so the range input has a value before hydration.
	form: await superValidate(zod(compositionSchema)),
});

export const actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod(compositionSchema));

		if (!form.valid) return fail(400, { form });

		return message(form, `Thanks, ${form.data.nickname}.`);
	},
};
