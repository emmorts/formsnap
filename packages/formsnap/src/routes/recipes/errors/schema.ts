import { z } from "zod/v3";

export const errorsSchema = z
	.object({
		start: z.string().min(1, "Choose a start date."),
		end: z.string().min(1, "Choose an end date."),
		contactNeeded: z.boolean().default(false),
		phone: z.string().default(""),
	})
	.superRefine((booking, context) => {
		if (booking.start && booking.end && booking.end <= booking.start) {
			// No field path: Superforms puts this cross-field issue in errors._errors.
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "The end date must be after the start date.",
			});
		}
		if (booking.contactNeeded && !booking.phone.trim()) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["phone"],
				message: "Enter a contact phone number.",
			});
		}
	});

export type ErrorsData = z.infer<typeof errorsSchema>;
