import { fail } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { errorsSchema } from "./schema.js";

export const load = async () => ({
	personal: await superValidate(zod(errorsSchema), { id: "errors-personal" }),
	work: await superValidate(zod(errorsSchema), { id: "errors-work" }),
});

async function save(request: Request, id: string) {
	const form = await superValidate(request, zod(errorsSchema), { id });
	if (!form.valid) return fail(400, { form });
	return message(form, "Booking saved.");
}

export const actions = {
	personal: ({ request }) => save(request, "errors-personal"),
	work: ({ request }) => save(request, "errors-work"),
};
