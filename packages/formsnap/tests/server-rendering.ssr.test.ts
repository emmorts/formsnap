import { describe, expect, it } from "vitest";
import { fixtureUrl } from "./fixture-url.js";
import { danglingReferences, duplicateIds, parseDocument } from "./html.js";
import { expectFixtureAssociations } from "./owned-associations.js";
import { expectOwnedFixture } from "./owned-fixture.js";

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

	it("references each field's owned description before any client code runs", async () => {
		expectFixtureAssociations(await renderFixture());
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
		expectFixtureAssociations(document);
		expect(danglingReferences(document)).toEqual([]);
	});

	it("accepts a submission that validates", async () => {
		const response = await submit("email=a@b.com&bio=hello");
		expect(response.status).toBe(200);

		const document = parseDocument(await response.text());
		expect(document.querySelector('[name="email"]')?.getAttribute("aria-invalid")).toBeNull();
		expectFixtureAssociations(document);
	});

	it.each(["arrays", "json"])(
		"renders owned inherited descriptions and row error targets on /%s",
		async (path) => {
			const response = await fetch(new URL(path, fixtureUrl()));
			expect(response.status).toBe(200);
			expectFixtureAssociations(parseDocument(await response.text()));
		}
	);

	it.each([false, true])(
		"declares owned SSR regions and executes content once (local=%s)",
		async (localInitially) => {
			const response = await fetch(new URL(`owned?local=${localInitially}`, fixtureUrl()));
			expect(response.status).toBe(200);
			expectOwnedFixture(parseDocument(await response.text()), localInitially);
		}
	);

	it.each(["description", "default-errors", "custom-errors"] as const)(
		"rejects custom Fieldset containers with active %s at runtime",
		async (mode) => {
			const response = await fetch(new URL(`owned?conflict=${mode}`, fixtureUrl()));
			expect(response.status).toBe(500);
		}
	);

	it("preserves unowned custom Fieldset containers with disabled regions and ID overrides", async () => {
		const response = await fetch(new URL("owned?conflict=disabled", fixtureUrl()));
		expect(response.status).toBe(200);
		const document = parseDocument(await response.text());
		expect(document.querySelector("section[data-custom-group]")).not.toBeNull();
		expect(document.querySelector("[data-fs-description], [data-fs-field-errors]")).toBeNull();
		expect(document.getElementById("unused-custom-help")).toBeNull();
		expect(document.getElementById("unused-custom-errors")).toBeNull();
	});
});
