import { invalid } from "@sveltejs/kit";
import { form } from "$app/server";
import { remoteSchema } from "./schema.js";

/**
 * Native SvelteKit remote form used as the baseline the Formsnap remote integration must match.
 * Rejections cover both schema issues and a server-only imperative issue that no schema can express.
 */
export const saveRemote = form(remoteSchema, async (data, issue) => {
	if (data.handle === "reserved") {
		invalid(issue.handle("This handle is reserved."));
	}

	return { saved: true, handle: data.handle, seats: data.seats };
});
