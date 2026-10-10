import { fail } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { announcementsSchema } from "./schema.js";

export const load = async () => ({
	// No data: the schema's rules are the only source of truth, and nothing is validated before the
	// first submission.
	form: await superValidate(zod(announcementsSchema)),
});

export const actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod(announcementsSchema));

		if (!form.valid) return fail(400, { form });

		return message(form, `Saved ${form.data.username}.`);
	},
};
