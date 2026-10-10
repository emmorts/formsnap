import { fail } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { groupsSchema } from "./schema.js";

export const load = async () => ({
	form: await superValidate(zod(groupsSchema)),
});

export const actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod(groupsSchema));

		if (!form.valid) return fail(400, { form });

		return message(form, "Agreements saved.");
	},
};
