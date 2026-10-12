import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { orderSchema } from "./schema.js";

export const load = async () => ({
	// An ordinary Superforms load. Nothing here knows that the submission will be a remote command: the
	// form, its stores and Formsnap's presentation are the same as anywhere else. The values are the
	// form's starting point, which is also what a successful reset returns to.
	form: await superValidate({ plan: "starter", seats: 1, note: "" }, zod(orderSchema), {
		id: "remote-command",
	}),
});
