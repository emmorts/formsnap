import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { ownedSchema } from "./schema.js";

export const load = async ({ url }: { url: URL }) => ({
	form: await superValidate(
		{ email: "invalid", bio: "Hello", urls: ["invalid", "https://second.example"] },
		zod(ownedSchema)
	),
	localInitially: url.searchParams.get("local") === "true",
	conflictMode: (["description", "default-errors", "custom-errors", "disabled"] as const).find(
		(mode) => mode === url.searchParams.get("conflict")
	),
});
