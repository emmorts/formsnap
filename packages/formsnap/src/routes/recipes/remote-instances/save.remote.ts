import { invalid } from "@sveltejs/kit";
import { form } from "$app/server";
import { orderLineSchema } from "./schema.js";

/**
 * What each of the order's lines allows. The instance key selects one of these records; it cannot
 * change what the record says, so a client-chosen key can neither invent a line nor raise a limit.
 * Only the server holds this, and only the server enforces it.
 */
const ORDER_LINES: Record<string, { limit: number }> = {
	line_a: { limit: 5 },
	line_b: { limit: 3 },
	line_c: { limit: 1 },
};

export const saveOrderLine = form(orderLineSchema, async (data, issue) => {
	const line = ORDER_LINES[data.id];

	if (!line) {
		// No path: the key is not something the user can correct in the form.
		invalid(issue("That order line is not on this order."));
	}

	// The record's own rule, checked for every submission no matter which key arrived.
	if (data.quantity > line.limit) {
		invalid(issue.quantity(`Only ${line.limit} of this line are left.`));
	}

	return {
		outcome: "accepted",
		id: data.id,
		label: data.label,
		quantity: data.quantity,
		attachment: data.attachment
			? `${data.attachment.name} (${data.attachment.size} bytes)`
			: "no file",
	} as const;
});
