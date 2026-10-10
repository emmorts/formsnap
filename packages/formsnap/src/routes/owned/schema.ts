import { z } from "zod/v3";

export const ownedSchema = z.object({
	email: z.string().email("Enter a valid email address."),
	bio: z.string(),
	urls: z.array(z.string().url("Enter a valid URL.")).min(3, "Enter three URLs."),
});

export type OwnedData = z.infer<typeof ownedSchema>;
