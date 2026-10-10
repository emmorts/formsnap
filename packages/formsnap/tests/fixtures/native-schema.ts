import { z } from "zod/v3";

/** Schema for the native checkbox, radio and select fixtures. */
export const nativeSchema = z.object({
	marketing: z.boolean(),
	theme: z.enum(["light", "dark"]),
});

export type NativeData = z.infer<typeof nativeSchema>;
