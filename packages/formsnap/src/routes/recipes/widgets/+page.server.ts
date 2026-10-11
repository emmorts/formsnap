import { fail } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { compositeSchema, nativeSchema } from "./schema.js";

export const load = async () => ({
	native: await superValidate(zod(nativeSchema), { id: "widgets-native" }),
	composite: await superValidate(zod(compositeSchema), { id: "widgets-composite" }),
});

export const actions = {
	native: async ({ request }) => {
		const form = await superValidate(request, zod(nativeSchema), { id: "widgets-native" });
		if (!form.valid) return fail(400, { form });
		return message(
			form,
			`Preferences saved: ${form.data.delivery}; ${form.data.channels.join(", ")}.`
		);
	},
	composite: async ({ request }) => {
		const form = await superValidate(request, zod(compositeSchema), {
			id: "widgets-composite",
		});
		if (!form.valid) return fail(400, { form });
		return message(form, `Collection point saved: ${form.data.collection}.`);
	},
};
