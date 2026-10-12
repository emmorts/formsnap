import { z } from "zod";

/**
 * Schema for the native remote-form baseline. zod 4 validates through Standard Schema, which is
 * what `$app/server`'s `form` consumes; note that `z.number()` and `z.boolean()` need the
 * matching `.as("number")` / `.as("checkbox")` input types so the transport arrives coerced.
 */
export const remoteSchema = z.object({
	handle: z.string().min(3).max(12),
	seats: z.number().int().min(1).max(10),
	notifications: z.boolean(),
	// A leading underscore marks a sensitive field: a rejected native submission must not echo it back.
	_password: z.string().min(4),
});

export type RemoteData = z.infer<typeof remoteSchema>;
