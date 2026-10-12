import { z } from "zod";

/**
 * One order line, edited through its own form instance.
 *
 * `id` is the instance key. Kit adds it for a `form.for(key)` instance — from the URL on a native
 * submission, and inside the payload on an enhanced one — so it arrives as client input like any
 * other value. It selects a record the server owns; it never authorises anything, which is why the
 * handler checks it against its own store instead of believing it.
 */
export const orderLineSchema = z.object({
	id: z.string(),
	label: z.string().min(1, "Enter a label.").max(20, "Keep the label to twenty characters."),
	quantity: z.number().int().min(1, "Order at least one.").max(5, "Order at most five."),
	notes: z.string().max(20, "Keep the notes to twenty characters.").default(""),
	// A picker hint is not a rule: the size limit is checked here, on the server, whatever the
	// browser let the user choose.
	attachment: z
		.instanceof(File, { message: "Choose a file." })
		.refine((file) => file.size <= 64_000, "Keep the file at or under 64 kB.")
		.optional(),
});

export type OrderLineData = z.infer<typeof orderLineSchema>;
