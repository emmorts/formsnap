import { z } from "zod/v3";

/**
 * The username carries two different messages so that a corrected value produces a visibly
 * different error in the same container — the update a live region announces.
 */
export const announcementsSchema = z.object({
	username: z
		.string()
		.min(3, "Use at least three characters.")
		.max(8, "Use at most eight characters."),
	nickname: z.string().min(2, "Use at least two characters."),
	note: z.string().min(1, "Enter a note.").max(12, "Keep the note to twelve characters."),
});

export type AnnouncementsData = z.infer<typeof announcementsSchema>;
