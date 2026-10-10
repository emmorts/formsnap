import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { contactsSchema } from "./schema.js";

export const load = async () => ({
	form: await superValidate(
		{
			profile: { name: "Ada" },
			contacts: [{ email: "a@example.com" }, { email: "b@example.com" }],
		},
		zod(contactsSchema)
	),
});

export const actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod(contactsSchema));
		return form.valid ? { form } : fail(400, { form });
	},
};
