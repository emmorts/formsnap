import { z } from "zod/v3";

/** Schema for the array-path fixtures. */
export const urlsSchema = z.object({
	urls: z.array(z.string()),
});

export type UrlsData = z.infer<typeof urlsSchema>;
