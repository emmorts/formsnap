// Superforms' own `fail` strips `File` values from the returned form, which SvelteKit's
// devalue-based serialization cannot encode.
import { fail, message, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { uploadSchema } from "./schema.js";

export const load = async () => ({
	// No data: the form starts empty and nothing is validated until a submission arrives.
	form: await superValidate(zod(uploadSchema)),
});

export const actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod(uploadSchema));

		if (!form.valid) return fail(400, { form });

		// `File` values never reach the client: Superforms strips them from the returned form,
		// because a file input cannot be repopulated. Report what arrived instead.
		const { name, size } = form.data.attachment;
		return message(form, `Received ${name} (${size} bytes).`);
	},
};
