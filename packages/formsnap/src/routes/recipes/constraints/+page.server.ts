import { fail } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { constraintsSchema } from "./schema.js";

export const load = async () => ({
	// No data: the schema's defaults give the empty form, and nothing is validated yet.
	form: await superValidate(zod(constraintsSchema)),
});

export const actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod(constraintsSchema));

		if (!form.valid) return fail(400, { form });

		return message(form, `Saved the handle ${form.data.handle}.`);
	},
};
