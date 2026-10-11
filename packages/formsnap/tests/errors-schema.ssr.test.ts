import { describe, expect, it } from "vitest";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { errorsSchema } from "../src/routes/recipes/errors/schema.js";

const orderMessage = "The end date must be after the start date.";

describe("booking calendar date validation", () => {
	it.each([
		"2026-1-01",
		"2026-01-01\n",
		"0000-01-01",
		"2026-00-01",
		"2026-13-01",
		"2026-01-00",
		"2026-04-31",
		"1900-02-29",
		"9007199254740992-01-01",
	])("rejects invalid start date %j without an order error", (start) => {
		const result = errorsSchema.safeParse({ start, end: "9999-12-31" });
		expect(result.success).toBe(false);
		if (result.success) throw new Error("Expected a start date validation error.");
		expect(result.error.issues.map(({ path, message }) => ({ path, message }))).toEqual([
			{ path: ["start"], message: "Choose a valid start date." },
		]);
	});

	it("reports malformed dates on both fields, not as a booking order error", async () => {
		const form = await superValidate(
			{ start: "not-a-date", end: "still-not-a-date" },
			zod(errorsSchema)
		);
		expect(form.valid).toBe(false);
		expect(form.errors).toEqual({
			start: ["Choose a valid start date."],
			end: ["Choose a valid end date."],
		});
	});

	it("reports an impossible end date only on the end field", async () => {
		const form = await superValidate(
			{ start: "2000-03-01", end: "2000-02-30" },
			zod(errorsSchema)
		);
		expect(form.valid).toBe(false);
		expect(form.errors).toEqual({ end: ["Choose a valid end date."] });
	});

	it.each([
		["0001-01-01", "0001-01-02"],
		["2000-02-29", "2000-03-01"],
		["2024-02-29", "2024-03-01"],
		["9999-12-31", "10000-01-01"],
		["10000-02-29", "10000-03-01"],
		["9007199254740991-12-30", "9007199254740991-12-31"],
	])("accepts chronological calendar dates %s to %s as strings", async (start, end) => {
		const form = await superValidate({ start, end }, zod(errorsSchema));
		expect(form.valid).toBe(true);
		expect(form.errors).toEqual({});
		expect(form.data).toEqual({ start, end, contactNeeded: false, phone: "" });
	});

	it.each([
		["2026-01-01", "2026-01-01"],
		["2026-01-02", "2026-01-01"],
		["2026-02-01", "2026-01-31"],
		["2027-01-01", "2026-12-31"],
		["10000-01-01", "9999-12-31"],
	])("rejects non-increasing dates %s to %s only at the root", async (start, end) => {
		const result = errorsSchema.safeParse({ start, end });
		expect(result.success).toBe(false);
		if (result.success) throw new Error("Expected a booking order validation error.");
		expect(result.error.issues.map(({ path, message }) => ({ path, message }))).toEqual([
			{ path: [], message: orderMessage },
		]);

		const form = await superValidate({ start, end }, zod(errorsSchema));
		expect(form.valid).toBe(false);
		expect(form.errors).toEqual({ _errors: [orderMessage] });
	});

	it("keeps empty-field prompts without extra date or order errors", async () => {
		const form = await superValidate({ start: "", end: "" }, zod(errorsSchema));
		expect(form.valid).toBe(false);
		expect(form.errors).toEqual({
			start: ["Choose a start date."],
			end: ["Choose an end date."],
		});
	});

	it("preserves optional phone validation alongside date errors", async () => {
		const form = await superValidate(
			{ start: "not-a-date", end: "2026-01-02", contactNeeded: true, phone: " \t " },
			zod(errorsSchema)
		);
		expect(form.valid).toBe(false);
		expect(form.errors).toEqual({
			start: ["Choose a valid start date."],
			phone: ["Enter a contact phone number."],
		});
	});
});
