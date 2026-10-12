import { z } from "zod/v3";

/**
 * One schema for both sides of this recipe: the Superforms load and client pass validate with it, and
 * the remote command validates its input with it on the server. Sharing it stops the two from
 * drifting, and it does not change who decides: the command's rejection is still the server's.
 *
 * It is a zod v3 schema because Superforms' adapters in the selected version expect that, and zod v3
 * implements Standard Schema, which is what `$app/server`'s `command` consumes.
 */
export const orderSchema = z.object({
	plan: z.enum(["starter", "pro"], { message: "Choose a plan." }),
	seats: z
		.number()
		.int()
		.min(1, "Book at least one seat.")
		.max(25, "Book at most twenty-five seats."),
	note: z.string().max(40, "Keep the note to forty characters.").default(""),
});

export type OrderData = z.infer<typeof orderSchema>;
