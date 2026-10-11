import { z } from "zod/v3";

export const multiStepSchema = z
	.object({
		name: z.string().trim().min(2, "Enter your full name."),
		email: z.string().trim().email("Enter a valid email address."),
		kind: z.enum(["personal", "business"]).default("personal"),
		company: z.string().trim().default(""),
		notes: z.string().trim().min(10, "Describe your request in at least 10 characters."),
	})
	.superRefine((data, context) => {
		if (data.kind === "business" && data.company.length < 2) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["company"],
				message: "Enter your company name.",
			});
		}
	});

export type MultiStepData = z.infer<typeof multiStepSchema>;

export const initialRequest: MultiStepData = {
	name: "",
	email: "",
	kind: "personal",
	company: "",
	notes: "",
};
