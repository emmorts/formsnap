import { describe, expect, it } from "vitest";
import { DEV_SERVER_URL } from "./dev-server.js";
import { danglingReferences, duplicateIds, parseDocument } from "./html.js";

async function renderFixture(): Promise<Document> {
	const response = await fetch(DEV_SERVER_URL);
	expect(response.status).toBe(200);
	return parseDocument(await response.text());
}

describe("server-rendered consumer fixture", () => {
	it("associates each label with the control it names", async () => {
		const document = await renderFixture();

		for (const [labelText, fieldName] of [
			["Email", "email"],
			["Bio", "bio"],
		] as const) {
			const control = document.querySelector(`[name="${fieldName}"]`);
			expect(control, `control for ${fieldName}`).not.toBeNull();

			const label = [...document.querySelectorAll("label")].find(
				(element) => element.textContent?.trim() === labelText
			);
			expect(label?.getAttribute("for"), `label for ${fieldName}`).toBe(
				control?.getAttribute("id")
			);
			expect(document.getElementById(control?.getAttribute("id") ?? "")).toBe(control);
		}
	});

	it("marks the controls of required fields as required", async () => {
		const document = await renderFixture();

		for (const fieldName of ["email", "bio"]) {
			expect(
				document.querySelector(`[name="${fieldName}"]`)?.getAttribute("aria-required"),
				`aria-required for ${fieldName}`
			).toBe("true");
		}
	});

	it("does not mark a form without errors as invalid", async () => {
		expect((await renderFixture()).querySelector("[aria-invalid]")).toBeNull();
	});

	it("renders the descriptions and the error containers", async () => {
		const document = await renderFixture();

		expect(document.body.textContent).toContain("We'll email you about your account.");
		expect(document.body.textContent).toContain("Tell us about yourself.");
		expect(document.querySelectorAll("[data-fs-field-errors]")).toHaveLength(2);
	});

	it("never references an element that is not rendered", async () => {
		expect(danglingReferences(await renderFixture())).toEqual([]);
	});

	it("never repeats an id", async () => {
		expect(duplicateIds(await renderFixture())).toEqual([]);
	});
});
