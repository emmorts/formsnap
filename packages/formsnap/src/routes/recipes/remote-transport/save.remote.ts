import { form } from "$app/server";
import { transportSchema } from "./schema.js";

/**
 * How many times this handler has run since the dev server started. It is a fixture's stand-in for a
 * server record, and it is returned in the result so a caller can see whether a submission reached
 * the handler at all: a client preflight failure returns before the request, so the count does not
 * move for one. The count belongs to the process, so a test compares it against an earlier read
 * rather than against a fixed number.
 */
let handled = 0;

/**
 * The handler reports exactly what it received, with the type each value arrived as. Nothing here
 * re-reads the request: a value that is wrong in the result was wrong on the wire.
 */
export const saveTransport = form(transportSchema, async (data) => {
	handled += 1;

	return {
		outcome: "accepted",
		attempts: handled,
		// Set by the submitter Kit folded into the payload, not by a rendered control.
		decision: data.decision,
		seats: data.seats,
		subscribe: data.subscribe,
		channels: data.channels.join(", "),
		attachment: data.attachment
			? `${data.attachment.name} (${data.attachment.size} bytes)`
			: "no file",
	} as const;
});
