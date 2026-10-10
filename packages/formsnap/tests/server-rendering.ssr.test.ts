import { describe, expect, it } from "vitest";
import { fixtureUrl } from "./fixture-url.js";
import { danglingReferences, duplicateIds, parseDocument } from "./html.js";

async function renderFixture(): Promise<Document> {
	const response = await fetch(fixtureUrl());
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

	it("uses the id a consumer supplies instead of generating one", async () => {
		const document = await renderFixture();

		const control = document.querySelector('[name="email"]');
		expect(control?.getAttribute("id")).toBe("email-input");
		const label = [...document.querySelectorAll("label")].find(
			(element) => element.textContent?.trim() === "Email"
		);
		expect(label?.getAttribute("for")).toBe("email-input");
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

	/** Submits the fixture form the way a browser without JavaScript would. */
	async function submit(body: string) {
		return fetch(fixtureUrl(), {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				// Kit re-renders the page for a document request; without this it answers with the
				// serialized action result, which is the fetch-driven path.
				accept: "text/html",
				origin: new URL(fixtureUrl()).origin,
			},
			body,
		});
	}

	it("renders the errors the action reports for a rejected submission", async () => {
		const response = await submit("email=not-an-email&bio=hi");
		expect(response.status).toBe(400);

		const document = parseDocument(await response.text());
		expect(document.querySelector('[name="email"]')?.getAttribute("aria-invalid")).toBe("true");
		expect(
			document.querySelector("[data-fs-field-errors]")?.textContent?.trim().length,
			"the rejected message is rendered"
		).toBeGreaterThan(0);
		expect(danglingReferences(document)).toEqual([]);
	});

	it("accepts a submission that validates", async () => {
		const response = await submit("email=a@b.com&bio=hello");
		expect(response.status).toBe(200);

		const document = parseDocument(await response.text());
		expect(document.querySelector('[name="email"]')?.getAttribute("aria-invalid")).toBeNull();
	});
});
