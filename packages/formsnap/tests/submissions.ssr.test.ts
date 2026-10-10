import { describe, expect, it } from "vitest";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { urlsSchema } from "./fixtures/urls-schema.js";

describe("array submissions through Superforms", () => {
	it("parses repeated names into the array that names the elements", async () => {
		const body = new FormData();
		body.append("urls", "https://a.example");
		body.append("urls", "https://b.example");

		const form = await superValidate(body, zod(urlsSchema));

		expect(form.valid).toBe(true);
		expect(form.data.urls).toEqual(["https://a.example", "https://b.example"]);
	});
});
