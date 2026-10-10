// `sveltekit-superforms` 3 types its zod adapter against the zod v3 API, which zod 3.25+ and
// zod 4 both expose at `zod/v3`. Importing from there keeps one fixture valid for both majors.
import { z } from "zod/v3";

/**
 * Schema for the fixture app. It mirrors the quickstart schema in the repository README so the
 * fixture can back the documented example.
 */
export const settingsSchema = z.object({
	email: z.string().email(),
	bio: z.string().max(250),
});

export type SettingsData = z.infer<typeof settingsSchema>;
