import { z } from "zod";

/**
 * Schema for the native remote-form baseline. zod 4 validates through Standard Schema, which is
 * what `$app/server`'s `form` consumes; note that `z.number()` and `z.boolean()` need the
 * matching `.as("number")` / `.as("checkbox")` input types so the transport arrives coerced.
 */
export const remoteSchema = z.object({
	handle: z.string().min(3).max(12),
	seats: z.number().int().min(1).max(10),
	// Kit requires booleans in a remote-form schema to be optional: an unchecked checkbox sends no
	// value at all, so a required boolean can never validate. The default keeps the handler simple.
	notifications: z.boolean().default(false),
	// An object array resolves to a group container rather than a scalar control, which is the
	// shape the type contracts assert. It defaults so an unrendered group still validates.
	links: z.array(z.object({ url: z.string() })).default([]),
	// A leading underscore marks a sensitive field: a rejected native submission must not echo it back.
	_password: z.string().min(4),
});

export type RemoteData = z.infer<typeof remoteSchema>;
