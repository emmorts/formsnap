import { error } from "@sveltejs/kit";
import { findOrder } from "../../orders.js";

export const load = async ({ params }) => {
	const order = findOrder(params.id);
	// The receipt reads the same store the command wrote to, through its own load. A missing order is a
	// real 404 rather than an empty page, which is what makes the mutation observable.
	if (!order) error(404, "That order does not exist.");
	return { order };
};
