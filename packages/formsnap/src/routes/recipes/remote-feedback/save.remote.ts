import { invalid } from "@sveltejs/kit";
import { form } from "$app/server";
import { feedbackSchema } from "./schema.js";

/**
 * Every rejection layer the recipe documents, in one handler: a deliberate unexpected failure, an
 * authorisation check with a path-less issue, a server-only business rule with a field path, and a
 * domain decision against stored data.
 *
 * Kit has already validated the submission against the shared schema before this runs, so nothing
 * here repeats a shape rule. Neither schema reads stored data; only this handler does.
 */

/** Stands in for the order's stored availability. A real handler would read a database here. */
const REMAINING_SEATS: Record<string, number> = { weekly: 4 };

/** Stands in for the order owner's stored credential. */
const ORDER_PASSWORD = "formsnap";

export const saveRemoteFeedback = form(feedbackSchema, async (data, issue) => {
	// The unexpected-error path. A thrown handler is not a validation outcome: it surfaces through
	// the nearest error boundary instead of producing issues, and the recipe triggers it on purpose.
	if (data.handle === "explode") {
		throw new Error("The seat ledger is unreachable.");
	}

	// Authorisation. The issue has no path, so it is form feedback rather than an error on one
	// control, and this is the rejection that never echoes the sensitive field back.
	if (data._password !== ORDER_PASSWORD) {
		invalid(issue("That password does not match the order owner."));
	}

	// A server-only business rule the user can fix in one input.
	if (data.handle === "reserved") {
		invalid(issue.handle("That handle is reserved."));
	}

	// The domain decision, taken against stored availability rather than against the input's shape.
	const remaining = REMAINING_SEATS[data.handle];
	if (remaining !== undefined && data.seats > remaining) {
		return {
			outcome: "declined",
			reason: `Only ${remaining} seats are left for ${data.handle}.`,
		} as const;
	}

	return {
		outcome: "accepted",
		handle: data.handle,
		seats: data.seats,
		channels: data.channels.join(", "),
	} as const;
});
