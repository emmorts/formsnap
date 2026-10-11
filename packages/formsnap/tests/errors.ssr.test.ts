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

async function openPage(javaScriptEnabled = true) {
	context = await browser.newContext({ javaScriptEnabled });
	const page = await context.newPage();
	page.on("console", (message) => {
		if (message.type() === "warning" || message.type() === "error") {
			diagnostics.push(`${message.type()}: ${message.text()}`);
		}
	});
	page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
	return page;
}

const errorsUrl = () => new URL("recipes/errors", fixtureUrl()).href;
const booking = (page: Page, scope = "personal") => page.getByTestId(`recipe-errors-${scope}`);
const summary = (page: Page, scope = "personal") => page.getByTestId(`errors-${scope}-summary`);

async function hydrated(page: Page) {
	await page.goto(errorsUrl());
	for (const scope of ["personal", "work"]) {
		await booking(page, scope).and(page.locator('[data-hydrated="true"]')).waitFor();
	}
}

async function assertReferences(page: Page) {
	const htmlDocument = parseDocument(await page.content());
	expect(duplicateIds(htmlDocument)).toEqual([]);
	expect(danglingReferences(htmlDocument)).toEqual([]);
}

async function dates(form: Locator, start: string, end: string) {
	await form.getByLabel("Start date", { exact: true }).fill(start);
	await form.getByLabel("End date", { exact: true }).fill(end);
}

async function submit(page: Page, scope = "personal") {
	const [response] = await Promise.all([
		page.waitForResponse(
			(candidate) =>
				candidate.request().method() === "POST" &&
				new URL(candidate.url()).pathname === new URL(errorsUrl()).pathname
		),
		booking(page, scope)
			.getByRole("button", { name: `Save ${scope} booking` })
			.click(),
	]);
	expect(response.status()).toBe(200);
	expect(response.request().isNavigationRequest()).toBe(false);
	return response.json();
}

async function assertSingleAnnouncement(form: Locator) {
	expect(await form.locator('[aria-live]:not([aria-live="off"])').count()).toBe(1);
	const regions = form.locator("[data-fs-field-errors]");
	for (const region of await regions.all()) {
		expect(await region.getAttribute("aria-live")).toBe("off");
		expect(await region.getAttribute("role")).not.toBe("alert");
	}
}

async function assertFieldLink(page: Page, label: string, message: string, scope = "personal") {
	const control = booking(page, scope).getByLabel(label, { exact: true });
	const link = summary(page, scope).getByRole("link", { name: `${label}: ${message}` });
	await link.waitFor();
	const id = await control.getAttribute("id");
	expect(id).toBeTruthy();
	expect(await link.getAttribute("href")).toBe(`#${id}`);
	await expect.poll(() => control.getAttribute("aria-invalid")).toBe("true");
	const descriptions = await control.evaluate((element) =>
		(element.getAttribute("aria-describedby") ?? "")
			.split(/\s+/)
			.filter(Boolean)
			.map((descriptionId) => document.getElementById(descriptionId)?.textContent?.trim())
	);
	expect(descriptions).toContain(message);
	await link.focus();
	await link.press("Enter");
	await expect
		.poll(() => control.evaluate((element) => element === document.activeElement))
		.toBe(true);
}

describe("form-wide validation and linked error summaries", () => {
	it("opens from the index and renders isolated labelled controls without JavaScript", async () => {
		const page = await openPage(false);
		await page.goto(new URL("recipes/", fixtureUrl()).href);
		const link = page.getByRole("link", {
			name: "Form-wide errors and summaries",
			exact: true,
		});
		await Promise.all([page.waitForNavigation(), link.click()]);
		expect(page.url()).toBe(errorsUrl());
		for (const scope of ["personal", "work"]) {
			expect(await booking(page, scope).count()).toBe(1);
			expect(await summary(page, scope).count()).toBe(0);
			for (const label of ["Start date", "End date", "Contact requested"]) {
				expect(await booking(page, scope).getByLabel(label, { exact: true }).count()).toBe(
					1
				);
			}
			await assertSingleAnnouncement(booking(page, scope));
		}
		await assertReferences(page);
	});

	it("renders a native rejected POST summary with links to the real date controls", async () => {
		const page = await openPage(false);
		await page.goto(errorsUrl());
		const [response] = await Promise.all([
			page.waitForNavigation(),
			booking(page).getByRole("button", { name: "Save personal booking" }).click(),
		]);
		expect(response?.status()).toBe(400);
		await assertFieldLink(page, "Start date", "Choose a start date.");
		await assertFieldLink(page, "End date", "Choose an end date.");
		expect(await summary(page, "work").count()).toBe(0);
		await assertSingleAnnouncement(booking(page));
		await assertReferences(page);
	});

	it("renders a real root refinement and an optional field after native rejection", async () => {
		const page = await openPage(false);
		await page.goto(errorsUrl());
		await dates(booking(page), "2026-12-12", "2026-12-10");
		await booking(page).getByLabel("Contact requested", { exact: true }).check();
		const [response] = await Promise.all([
			page.waitForNavigation(),
			booking(page).getByRole("button", { name: "Save personal booking" }).click(),
		]);
		expect(response?.status()).toBe(400);
		const root = summary(page)
			.locator("li")
			.filter({ hasText: "The end date must be after the start date." });
		expect(await root.innerText()).toBe("Booking: The end date must be after the start date.");
		expect(await root.getByRole("link").count()).toBe(0);
		expect(await booking(page).getByLabel("Contact phone", { exact: true }).isVisible()).toBe(
			true
		);
		await assertFieldLink(page, "Contact phone", "Enter a contact phone number.");
		expect(await summary(page).getByRole("link").count()).toBe(1);
		await assertSingleAnnouncement(booking(page));
		await assertReferences(page);
	});

	it("links enhanced field errors by keyboard and removes the summary on success", async () => {
		const page = await openPage();
		await hydrated(page);
		expect(await submit(page)).toMatchObject({ type: "failure", status: 400 });
		await assertFieldLink(page, "Start date", "Choose a start date.");
		await assertFieldLink(page, "End date", "Choose an end date.");
		await assertSingleAnnouncement(booking(page));
		await dates(booking(page), "2026-12-10", "2026-12-12");
		expect(await submit(page)).toMatchObject({ type: "success", status: 200 });
		await expect.poll(() => summary(page).count()).toBe(0);
		expect(await page.getByTestId("errors-personal-success").innerText()).toBe(
			"Booking saved."
		);
		expect(await booking(page).locator('[aria-invalid="true"]').count()).toBe(0);
		await assertReferences(page);
	});

	it("keeps a root-only rejection readable without inventing a field target or moving focus", async () => {
		const page = await openPage();
		await hydrated(page);
		await dates(booking(page), "2026-12-12", "2026-12-10");
		expect(await submit(page)).toMatchObject({ type: "failure", status: 400 });
		await summary(page).waitFor();
		expect(await summary(page).innerText()).toContain(
			"Booking: The end date must be after the start date."
		);
		expect(await summary(page).getByRole("link").count()).toBe(0);
		expect(await booking(page).locator('[aria-invalid="true"]').count()).toBe(0);
		expect(
			await booking(page)
				.getByRole("button", { name: "Save personal booking" })
				.evaluate((element) => element === document.activeElement)
		).toBe(true);
		await assertSingleAnnouncement(booking(page));
	});

	it("keeps two rejected forms and their keyboard targets independent", async () => {
		const page = await openPage();
		await hydrated(page);
		await dates(booking(page), "2026-12-12", "2026-12-10");
		expect(await submit(page)).toMatchObject({ type: "failure", status: 400 });
		await summary(page).waitFor();
		expect(await summary(page, "work").count()).toBe(0);
		expect(await submit(page, "work")).toMatchObject({ type: "failure", status: 400 });
		await assertFieldLink(page, "Start date", "Choose a start date.", "work");
		await assertFieldLink(page, "End date", "Choose an end date.", "work");
		expect(await summary(page).innerText()).toContain(
			"The end date must be after the start date."
		);
		expect(await summary(page).getByRole("link").count()).toBe(0);
		await dates(booking(page, "work"), "2026-12-10", "2026-12-12");
		expect(await submit(page, "work")).toMatchObject({ type: "success", status: 200 });
		await expect.poll(() => summary(page, "work").count()).toBe(0);
		expect(await page.getByTestId("errors-work-success").innerText()).toBe("Booking saved.");
		// A success makes Superforms re-run the route's load, and every form whose id appears in the
		// refreshed data rebinds to it. This load has no saved booking, so the personal form
		// re-initializes with the refreshed data: its values and its summary reset.
		await expect.poll(() => summary(page).count(), { timeout: 15000 }).toBe(0);
		expect(await booking(page).getByLabel("Start date", { exact: true }).inputValue()).toBe("");
		await assertReferences(page);
	});

	it("expands a collapsed target and drops its link when the conditional section is removed", async () => {
		const page = await openPage();
		await hydrated(page);
		await dates(booking(page), "2026-12-12", "2026-12-10");
		const contact = booking(page).getByLabel("Contact requested", { exact: true });
		await contact.check();
		expect(await submit(page)).toMatchObject({ type: "failure", status: 400 });
		const phone = booking(page).getByLabel("Contact phone", { exact: true });
		await summary(page)
			.getByRole("link", { name: "Contact phone: Enter a contact phone number." })
			.waitFor();
		await booking(page).locator("summary").click();
		expect(await phone.isVisible()).toBe(false);
		await assertFieldLink(page, "Contact phone", "Enter a contact phone number.");
		expect(await phone.isVisible()).toBe(true);
		await contact.uncheck();
		await expect.poll(() => phone.count()).toBe(0);
		await expect.poll(() => summary(page).getByRole("link").count()).toBe(0);
		expect(await summary(page).innerText()).toContain(
			"Contact phone: Enter a contact phone number."
		);
		expect(await summary(page).innerText()).toContain(
			"Booking: The end date must be after the start date."
		);
		await assertReferences(page);
		// Re-mounting restores the same caller-owned target; another Enter reaches the new node.
		await contact.check();
		await assertFieldLink(page, "Contact phone", "Enter a contact phone number.");
		await contact.uncheck();
		await dates(booking(page), "2026-12-10", "2026-12-12");
		expect(await submit(page)).toMatchObject({ type: "success", status: 200 });
		await expect.poll(() => summary(page).count()).toBe(0);
		await assertSingleAnnouncement(booking(page));
		await assertReferences(page);
	});

	it("clears only the chosen form's errors without losing values or another summary", async () => {
		const page = await openPage();
		await hydrated(page);
		await dates(booking(page), "2026-12-12", "2026-12-10");
		expect(await submit(page)).toMatchObject({ type: "failure", status: 400 });
		await summary(page).waitFor();
		expect(await submit(page, "work")).toMatchObject({ type: "failure", status: 400 });
		await summary(page, "work").waitFor();
		await booking(page).getByRole("button", { name: "Clear errors", exact: true }).click();
		await expect.poll(() => summary(page).count()).toBe(0);
		expect(await booking(page).getByLabel("Start date", { exact: true }).inputValue()).toBe(
			"2026-12-12"
		);
		expect(await booking(page).getByLabel("End date", { exact: true }).inputValue()).toBe(
			"2026-12-10"
		);
		expect(await summary(page, "work").getByRole("link").count()).toBe(2);
		await assertReferences(page);
		// Clearing presentation does not accept invalid dates: the next server POST rejects again.
		expect(await submit(page)).toMatchObject({ type: "failure", status: 400 });
		await summary(page).waitFor();
		expect(await summary(page).innerText()).toContain(
			"The end date must be after the start date."
		);
	});
});
