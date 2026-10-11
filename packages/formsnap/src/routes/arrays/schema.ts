import { z } from "zod/v3";

export const urlsSchema = z.object({
	urls: z.array(z.string().url("Enter a valid URL.")).min(1, "Add at least one URL."),
});

export type UrlsData = z.infer<typeof urlsSchema>;
