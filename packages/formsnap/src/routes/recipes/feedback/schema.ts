import { z } from "zod/v3";

export const feedbackSchema = z.object({
	answer: z.string().min(1, "Enter an answer."),
});

export type FeedbackData = z.infer<typeof feedbackSchema>;
