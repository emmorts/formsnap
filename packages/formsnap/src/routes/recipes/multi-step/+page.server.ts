import { fail } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { multiStepSchema } from "./schema.js";

export const load = async () => ({
	form: await superValidate(zod(multiStepSchema), { id: "multi-step" }),
});

export const actions = {
	default: async ({ request }) => {
		// No step token or client "valid" flag is trusted. Validate the complete request
		// again, including the conditional company requirement, for every final POST.
		const form = await superValidate(request, zod(multiStepSchema), { id: "multi-step" });
		if (!form.valid) return fail(400, { form });
		// Retain while editing, but never use inactive company data at the server boundary.
		if (form.data.kind === "personal") form.data.company = "";
		// A real application would persist only after validation (and authorization).
		return message(form, "Server validation passed. This example did not save your request.");
	},
};
