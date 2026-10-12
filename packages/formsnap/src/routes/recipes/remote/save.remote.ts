import { invalid } from "@sveltejs/kit";
import { form } from "$app/server";
import { remoteRecipeSchema } from "./schema.js";

/**
 * The native remote form behind the recipe. Kit validates the submission against the shared schema
 * before this runs, so what is left here is the part no schema can express: authorisation, a
 * server-only business rule, and a domain decision.
 *
 * The result is a discriminated union rather than a bare record, because a result can also mean
 * "the business said no". The page reads `outcome` and never the existence of a result: Kit's own
 * enhancement resets a submission that returns no issues, and a refused domain result has none.
 */

/** Stands in for the order owner's stored credential. Only the server can check it. */
const ORDER_PASSWORD = "formsnap";

export const saveRemoteOrder = form(remoteRecipeSchema, async (data, issue) => {
	// Authorisation. The issue has no path, which is what makes it form-wide feedback rather than an
	// error on one input, and it is the rejection that cannot echo the sensitive field back.
	if (data._password !== ORDER_PASSWORD) {
		invalid(issue("That password does not match the order owner."));
	}

	// A server-only business rule the user can fix in one input.
	if (data.title.trim().toLowerCase() === "reserved") {
		invalid(issue.title("That title is reserved."));
	}

	// A domain decision: the input is valid, the business declines it. A result, not an issue,
	// because there is nothing in the form for the user to correct.
	if (data.delivery.method === "courier" && data.delivery.postcode.startsWith("9")) {
		return {
			outcome: "unavailable",
			reason: "The courier does not deliver to the 9xxx postcode area.",
		} as const;
	}

	return {
		outcome: "accepted",
		title: data.title,
		seats: data.seats,
		notifications: data.notifications,
		channels: data.channels.join(", "),
		delivery: data.delivery.method,
	} as const;
});
