import { z } from "zod";

/**
 * Two schemas for the transport fixture, because the client pass and the server contract are allowed
 * to disagree. The client pass checks the seat count, which is worth blocking a round trip on. The
 * server schema additionally owns the group rule and the file limit, and it holds the largest seat
 * count the fixture accepts, so a submission can pass the client and still be rejected on the server.
 *
 * They describe the same submission rather than one extending the other, because a form's
 * `preflight` takes a schema of the form's own input shape.
 *
 * `decision` is the field two submit buttons name: Kit folds the activated submitter into the
 * payload under that field, so the handler can tell which button was pressed. It defaults, because a
 * submission with no submitter (a programmatic submit) carries nothing for it.
 */

const decision = z.enum(["save", "publish"]).default("save");
const seats = z.number();
const channelOptions = z.enum(["email", "sms", "push"]);
// The client pass declares the group so its input shape matches the form's, but it deliberately does
// not judge it: `catch` keeps a submission whose group is missing or malformed moving to the server,
// which owns the group rule. A pass that failed here would stand in for the contract instead.
const preflightChannels = z.array(channelOptions).catch([]);
// An unchecked group sends nothing at all, so the missing and empty cases read the same.
const channels = z.array(channelOptions, { error: "Choose at least one channel." });

export const transportPreflightSchema = z.object({
	decision,
	seats: seats.int().min(1, "Book at least one seat."),
	subscribe: z.boolean().default(false),
	// Typed but not judged by the client pass: the group rule and the file limit are the server's.
	channels: preflightChannels,
	attachment: z.instanceof(File).optional(),
});

export const transportSchema = z.object({
	decision,
	seats: seats.int().min(1, "Book at least one seat.").max(9, "Book at most nine seats."),
	subscribe: z.boolean().default(false),
	channels: channels.min(1, "Choose at least one channel."),
	// A picker hint is not a rule: the size limit is checked here, on the server, whatever the
	// browser let the user choose.
	attachment: z
		.instanceof(File, { message: "Choose a file." })
		.refine((file) => file.size <= 64_000, "Keep the file at or under 64 kB.")
		.optional(),
});

export type TransportData = z.infer<typeof transportSchema>;
