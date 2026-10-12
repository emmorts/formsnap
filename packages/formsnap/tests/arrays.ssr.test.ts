import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import { fixtureUrl } from "./fixture-url.js";
import { danglingReferences, duplicateIds, parseDocument } from "./html.js";

let browser: Browser;
let context: BrowserContext | undefined;
let diagnostics: string[];

beforeAll(async () => {
	browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
	await browser?.close();
});

beforeEach(() => {
	diagnostics = [];
});

afterEach(async () => {
	await context?.close();
	context = undefined;
	// Native rejection intentionally returns HTTP 400; application diagnostics still fail.
	expect(diagnostics.filter((text) => !/Failed to load resource:.*400/.test(text))).toEqual([]);
});

const rows = (page: Page) => page.locator("[data-row]");
const mutation = (page: Page) => page.getByTestId("array-mutations");

async function openPage(javaScriptEnabled = true) {
	context = await browser.newContext({ javaScriptEnabled });
	const page = await context.newPage();
	page.on("console", (message) => {
		if (message.type() === "warning" || message.type() === "error") {
			diagnostics.push(`${message.type()}: ${message.text()}`);
		}
	});
	page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
	await page.goto(new URL("arrays", fixtureUrl()).href);
	if (javaScriptEnabled) await page.locator('form[data-hydrated="true"]').waitFor();
	return page;
}

async function assertReferences(page: Page) {
	const document = parseDocument(await page.content());
	expect(duplicateIds(document)).toEqual([]);
	expect(danglingReferences(document)).toEqual([]);
	for (const input of document.querySelectorAll('input[name="urls"]')) {
		expect(document.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
	}
}

async function focused(control: Locator) {
	await expect
		.poll(() => control.evaluate((element) => element === document.activeElement))
		.toBe(true);
}

async function rowError(row: Locator, invalid: boolean) {
	const input = row.locator("input");
	await expect.poll(() => input.getAttribute("aria-invalid")).toBe(invalid ? "true" : null);
	const region = row.locator("[data-fs-field-errors]");
	if (invalid) {
		expect(await region.innerText()).toContain("Enter a valid URL.");
		const errorId = await region.getAttribute("id");
		const descriptions = (await input.getAttribute("aria-describedby"))?.split(/\s+/);
		expect(descriptions).toContain(errorId);
		expect(
			await input.evaluate((element) =>
				(element.getAttribute("aria-describedby") ?? "")
					.split(/\s+/)
					.filter(Boolean)
					.map((id) => document.getElementById(id)?.textContent?.trim())
			)
		).toContain("Enter a valid URL.");
	} else {
		expect(await region.innerText()).not.toContain("Enter a valid URL.");
	}
}

async function submit(page: Page) {
	const [response] = await Promise.all([
		page.waitForResponse(
			(candidate) =>
				candidate.request().method() === "POST" &&
				new URL(candidate.url()).pathname === new URL("arrays", fixtureUrl()).pathname
		),
		page.getByRole("button", { name: "Save URLs", exact: true }).click(),
	]);
	const body = await response.json();
	// SvelteKit 3 returns the `fail` status for enhanced submissions, so the HTTP status now
	// matches the status encoded in the ActionResult body instead of always being 200.
	expect(response.status()).toBe(body.status);
	expect(response.request().isNavigationRequest()).toBe(false);
	return body;
}

async function announcement(page: Page, previous: string) {
	await expect.poll(() => mutation(page).innerText()).not.toBe(previous);
	expect(await mutation(page).getAttribute("aria-live")).toBe("polite");
	expect(await mutation(page).getAttribute("aria-atomic")).toBe("true");
	return mutation(page).innerText();
}

async function absentIds(page: Page, ids: (string | null)[]) {
	for (const id of ids) {
		expect(id).toBeTruthy();
		expect(await page.locator(`[id="${id}"]`).count()).toBe(0);
		expect(
			await page
				.locator(
					`[aria-describedby~="${id}"], [aria-labelledby~="${id}"], label[for="${id}"]`
				)
				.count()
		).toBe(0);
	}
	await assertReferences(page);
}

describe("accessible primitive arrays after real validation", () => {
	it("moves errors, taint and stable DOM targets with invalid values, focuses added rows, and saves corrections through Superforms", async () => {
		const page = await openPage();
		let announced = await mutation(page).innerText();
		const invalidRow = rows(page).nth(0);
		const inputHandle = await invalidRow.locator("input").elementHandle();
		const errorHandle = await invalidRow.locator("[data-fs-field-errors]").elementHandle();
		const inputId = await invalidRow.locator("input").getAttribute("id");
		const errorId = await invalidRow.locator("[data-fs-field-errors]").getAttribute("id");
		await invalidRow.locator("input").fill("invalid-first");
		expect(await submit(page)).toMatchObject({ type: "failure", status: 400 });
		await rowError(rows(page).nth(0), true);
		await rowError(rows(page).nth(1), false);
		const reorder = page.getByRole("button", { name: "Reorder rows", exact: true });
		await reorder.focus();
		await reorder.press("Enter");
		announced = await announcement(page, announced);
		await focused(reorder);
		expect(await rows(page).nth(1).locator("input").inputValue()).toBe("invalid-first");
		expect(await rows(page).nth(1).locator("input").getAttribute("id")).toBe(inputId);
		expect(await rows(page).nth(1).locator("[data-fs-field-errors]").getAttribute("id")).toBe(
			errorId
		);
		expect(await inputHandle!.evaluate((element) => element.isConnected)).toBe(true);
		expect(await errorHandle!.evaluate((element) => element.isConnected)).toBe(true);
		expect(await rows(page).nth(1).locator("output").getAttribute("data-tainted")).toBe("true");
		expect(
			await rows(page)
				.nth(0)
				.locator("output")
				.evaluate((element) => element.dataset.tainted === "true")
		).toBe(false);
		await rowError(rows(page).nth(1), true);
		await rowError(rows(page).nth(0), false);
		await page.getByRole("button", { name: "Add row", exact: true }).click();
		await announcement(page, announced);
		await focused(rows(page).nth(2).locator("input"));
		await rowError(rows(page).nth(2), false);
		await rowError(rows(page).nth(1), true);
		await page.getByLabel("URL 2", { exact: true }).fill("https://fixed.example");
		// This recipe keeps the last submitted errors until another real save, not a fake
		// optimistic validation. Superforms owns their removal on the successful result.
		await rowError(rows(page).nth(1), true);
		expect(await submit(page)).toMatchObject({ type: "success", status: 200 });
		await page.getByTestId("arrays-success").waitFor();
		expect(JSON.parse(await page.getByTestId("submission-data").innerText())).toEqual({
			urls: ["https://b.example", "https://fixed.example", "https://added.example"],
		});
		expect(await page.locator('[aria-invalid="true"]').count()).toBe(0);
		expect(await rows(page).count()).toBe(3);
		expect(await rows(page).nth(1).locator("input").getAttribute("id")).toBe(inputId);
		await assertReferences(page);
	});

	it("removes invalid row metadata and keyboard targets while recovering to the next, previous and Add row controls", async () => {
		const page = await openPage();
		let announced = await mutation(page).innerText();
		await page.getByLabel("URL 1", { exact: true }).fill("invalid-a");
		await page.getByLabel("URL 2", { exact: true }).fill("invalid-b");
		expect(await submit(page)).toMatchObject({ type: "failure", status: 400 });
		await rowError(rows(page).nth(0), true);
		await rowError(rows(page).nth(1), true);
		await page.getByRole("button", { name: "Reorder rows", exact: true }).click();
		announced = await announcement(page, announced);
		const removedIds = [
			await rows(page).nth(0).getAttribute("id"),
			await rows(page).nth(0).locator("input").getAttribute("id"),
			await rows(page).nth(0).locator("[data-fs-field-errors]").getAttribute("id"),
		];
		const retainedId = await rows(page).nth(1).locator("input").getAttribute("id");
		await rows(page).nth(0).locator("input").focus();
		await page.keyboard.press("Tab");
		await focused(page.getByRole("button", { name: "Remove URL 1", exact: true }));
		await page.keyboard.press("Enter");
		announced = await announcement(page, announced);
		await focused(rows(page).nth(0).locator("input"));
		expect(await rows(page).nth(0).locator("input").getAttribute("id")).toBe(retainedId);
		expect(await rows(page).nth(0).locator("input").inputValue()).toBe("invalid-a");
		await rowError(rows(page).nth(0), true);
		expect(JSON.parse(await page.getByTestId("submission-errors").innerText()).urls).toEqual({
			0: ["Enter a valid URL."],
		});
		await absentIds(page, removedIds);

		await page.getByRole("button", { name: "Add row", exact: true }).click();
		announced = await announcement(page, announced);
		await focused(rows(page).nth(1).locator("input"));
		await page.keyboard.press("Tab");
		await focused(page.getByRole("button", { name: "Remove URL 2", exact: true }));
		await page.keyboard.press("Enter");
		announced = await announcement(page, announced);
		await focused(rows(page).nth(0).locator("input"));
		await rowError(rows(page).nth(0), true);
		const lastIds = [
			await rows(page).nth(0).getAttribute("id"),
			await rows(page).nth(0).locator("input").getAttribute("id"),
			await rows(page).nth(0).locator("[data-fs-field-errors]").getAttribute("id"),
		];
		await page.keyboard.press("Tab");
		await page.keyboard.press("Enter");
		announced = await announcement(page, announced);
		await focused(page.getByRole("button", { name: "Add row", exact: true }));
		expect(await rows(page).count()).toBe(0);
		expect(JSON.parse(await page.getByTestId("submission-errors").innerText()).urls).toEqual(
			{}
		);
		await absentIds(page, lastIds);
		expect(await submit(page)).toMatchObject({ type: "failure", status: 400 });
		await expect
			.poll(() => page.locator("fieldset > [data-fs-field-errors]").innerText())
			.toContain("Add at least one URL.");
		await page.getByRole("button", { name: "Add row", exact: true }).click();
		await announcement(page, announced);
		await focused(rows(page).nth(0).locator("input"));
		expect(await page.locator("fieldset > [data-fs-field-errors]").innerText()).not.toContain(
			"Add at least one URL."
		);
		expect(await submit(page)).toMatchObject({ type: "success", status: 200 });
		await page.getByTestId("arrays-success").waitFor();
		await assertReferences(page);
	});

	it("announces repeated identical reorders in one persistent polite region without remounting row associations", async () => {
		const page = await openPage();
		let announced = await mutation(page).innerText();
		const liveRegion = await mutation(page).elementHandle();
		const firstInput = await rows(page).nth(0).locator("input").elementHandle();
		const firstId = await rows(page).nth(0).locator("input").getAttribute("id");
		const reorder = page.getByRole("button", { name: "Reorder rows", exact: true });
		await reorder.focus();
		await reorder.press("Enter");
		announced = await announcement(page, announced);
		await reorder.press("Enter");
		await announcement(page, announced);
		await focused(reorder);
		expect(await liveRegion!.evaluate((element) => element.isConnected)).toBe(true);
		expect(await firstInput!.evaluate((element) => element.isConnected)).toBe(true);
		expect(await rows(page).nth(0).locator("input").getAttribute("id")).toBe(firstId);
		expect(await rows(page).nth(0).locator("input").inputValue()).toBe("https://a.example");
		await assertReferences(page);
	});
});
