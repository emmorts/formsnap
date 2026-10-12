import { z } from "zod";

/**
 * The schema of the runnable native remote-form recipe. It lives in its own module because a
 * `.remote.ts` module may only export remote functions, so the page and the handler share the
 * schema and its inferred type from here.
 *
 * zod 4 validates through Standard Schema, which is what `$app/server`'s `form` consumes. Booleans
 * must be optional: an unchecked checkbox sends no value at all, so a required boolean could never
 * validate.
 */

/**
 * The delivery group. Its constraint spans the group's own members, which no single field could
 * check: a courier needs a postcode, and pickup must not ask for one. The issue keeps a path
 * inside the group, so it is reported on the member that has to change.
 */
const deliverySchema = z
	.object({
		method: z.enum(["pickup", "courier"]),
		postcode: z.string().default(""),
	})
	.refine((delivery) => delivery.method !== "courier" || /^[0-9]{4}$/.test(delivery.postcode), {
		message: "A courier needs a four-digit postcode.",
		path: ["postcode"],
	});

export const remoteRecipeSchema = z.object({
	// Rendered with a default, so the recipe is an edit form rather than an empty one.
	title: z
		.string()
		.min(3, "Use at least three characters.")
		.max(40, "Keep the title to forty characters."),
	seats: z.number().int().min(1, "Book at least one seat.").max(10, "Book at most ten seats."),
	notifications: z.boolean().default(false),
	// A primitive array leaf is a choice group: one checkbox per option, all carrying the field name.
	// An unchecked group sends nothing at all, so the missing-array and empty-array cases read the
	// same to the user.
	channels: z
		.array(z.enum(["email", "sms", "push"]), { error: "Choose at least one channel." })
		.min(1, "Choose at least one channel."),
	delivery: deliverySchema,
	// A leading underscore marks a sensitive field: a rejected native submission never echoes it
	// back, so it cannot be repopulated from the response and the user has to type it again.
	_password: z.string().min(1, "Enter the account password."),
});

export type RemoteRecipeData = z.infer<typeof remoteRecipeSchema>;
