import { z } from "zod/v3";

/** Schema for the nested-path fixtures. */
export const pathsSchema = z.object({
	profile: z.object({
		name: z.string().min(2),
	}),
	urls: z.array(z.string().url()),
	items: z.array(z.object({ id: z.number().int().min(1) })),
	matrix: z.array(z.array(z.string().min(1))),
	nickname: z.string().optional(),
	optionalProfile: z.object({ name: z.string() }).optional(),
	optionalUrls: z.array(z.string()).optional(),
	codes: z.object({ "123": z.string().min(2) }),
	"contact.email": z.string(),
	"contact[0]": z.string().min(3),
});

export type PathsData = z.infer<typeof pathsSchema>;
