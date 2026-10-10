import { z } from "zod/v3";

export const groupsSchema = z.object({
	nativeAccepted: z
		.boolean()
		.default(false)
		.refine((accepted) => accepted, "Accept the native terms."),
	customAccepted: z
		.boolean()
		.default(false)
		.refine((accepted) => accepted, "Accept the custom terms."),
});

export type GroupsData = z.infer<typeof groupsSchema>;
