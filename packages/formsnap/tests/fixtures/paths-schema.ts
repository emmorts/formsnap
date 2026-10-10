import { z } from "zod/v3";

/** Schema for the nested-path fixtures. */
export const pathsSchema = z.object({
	profile: z.object({
		name: z.string().min(2),
	}),
	urls: z.array(z.string().url()),
	items: z.array(z.object({ id: z.number().int() })),
	matrix: z.array(z.array(z.string())),
	nickname: z.string().optional(),
});

export type PathsData = z.infer<typeof pathsSchema>;
