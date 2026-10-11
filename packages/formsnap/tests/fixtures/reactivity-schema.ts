import { z } from "zod/v3";

export const reactivitySchema = z.object({
	profile: z.object({ name: z.string().min(2), sibling: z.string().min(3) }),
	rows: z.array(z.object({ name: z.string().min(4) })),
});

export type ReactivityData = z.infer<typeof reactivitySchema>;

export const reactivityData: ReactivityData = {
	profile: { name: "Ada", sibling: "unchanged" },
	rows: [{ name: "first row" }, { name: "second row" }],
};
