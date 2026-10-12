import { z } from "zod";

/**
 * Two schemas for the feedback recipe, because the client and the server are allowed to disagree.
 *
 * `feedbackPreflightSchema` is what the browser runs before the request: the rules worth blocking a
 * round trip on. The server schema is the contract, and it has a rule the preflight pass does not
 * check, so a submission can pass the client and still be rejected by the server. Neither schema
 * reads stored data: the handler owns that, and it is where the business rules live.
 *
 * They describe the same submission rather than one extending the other, because a form's
 * `preflight` takes a schema of the form's own input shape: a narrower schema would not describe the
 * same submission even if it checked fewer rules.
 */

const handle = z.string();
const seats = z.number();
// An unchecked group sends nothing at all, so the missing and empty cases read the same.
const channels = z.array(z.enum(["email", "sms", "push"]), {
	error: "Choose at least one channel.",
});

export const feedbackPreflightSchema = z.object({
	handle: handle.min(3, "Use at least three characters."),
	seats: seats.int().min(1, "Book at least one seat.").max(10, "Book at most ten seats."),
	channels: channels.min(1, "Choose at least one channel."),
	// Accepted as-is by the client pass; the max length is the server schema's rule.
	notes: z.string().default(""),
	// Typed but not judged: whether this is the owner's password is the handler's decision.
	_password: z.string(),
});

export const feedbackSchema = z.object({
	handle: handle.min(3, "Use at least three characters."),
	seats: seats.int().min(1, "Book at least one seat.").max(10, "Book at most ten seats."),
	channels: channels.min(1, "Choose at least one channel."),
	// The rule the preflight pass does not check. It defaults, so removing the conditional field
	// still leaves a submittable form.
	notes: z.string().max(20, "Keep the notes to twenty characters.").default(""),
	// A leading underscore marks a sensitive field: a rejected submission never echoes it back.
	_password: z.string().min(1, "Enter the account password."),
});

export type FeedbackData = z.infer<typeof feedbackSchema>;
