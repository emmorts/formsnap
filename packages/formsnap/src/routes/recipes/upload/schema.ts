import { z } from "zod/v3";

/**
 * A file input is the one control whose value cannot be read back from the DOM, so the schema
 * validates the `File` that Superforms parses out of the multipart submission.
 */
export const uploadSchema = z.object({
	title: z.string().min(1, "Enter a title."),
	attachment: z
		.instanceof(File, { message: "Choose a file." })
		.refine((file) => file.size > 0, "Choose a file.")
		.refine((file) => file.size <= 64_000, "Keep the file at or under 64 kB."),
});

export type UploadData = z.infer<typeof uploadSchema>;
