import { z } from "zod/v3";

/**
 * A range input submits a string; `z.coerce` turns it back into the number that the form store and
 * the snippet values already hold in the browser.
 */
export const compositionSchema = z.object({
	nickname: z.string().min(2, "Use at least two characters."),
	rating: z.coerce
		.number()
		.int("Pick a whole number of stars.")
		.min(1, "Pick at least one star.")
		.max(5, "Five stars is the maximum.")
		.default(4),
});

export type CompositionData = z.infer<typeof compositionSchema>;
