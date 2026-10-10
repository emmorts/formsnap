import { z } from "zod/v3";

export const contactsSchema = z.object({
	profile: z.object({ name: z.string().min(2, "Enter at least two characters.") }),
	contacts: z.array(z.object({ email: z.string().email("Enter a valid email address.") })).min(1),
});

export type ContactsData = z.infer<typeof contactsSchema>;
