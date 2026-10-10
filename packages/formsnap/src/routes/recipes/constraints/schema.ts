import { z } from "zod/v3";

/**
 * The handle is constrained twice: the input carries HTML attributes for the browser, and the
 * schema constrains the same value again — plus the reserved-name rule that no HTML attribute can
 * express. Keeping the two sets different is what makes the recipe show who rejected what.
 */
export const constraintsSchema = z.object({
	handle: z
		.string()
		.min(3, "Use at least three characters.")
		.max(12, "Use at most twelve characters.")
		.regex(/^[a-z0-9_]+$/, "Use lowercase letters, digits and underscores.")
		.refine((value) => value !== "admin", "This handle is reserved."),
	invite: z.string().regex(/^INV-\d{3}$/, "Enter an invite code such as INV-123."),
});

export type ConstraintsData = z.infer<typeof constraintsSchema>;
