import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import { fixtureUrl } from "./fixture-url.js";

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
	expect(diagnostics.filter((text) => !/Failed to load resource:.*400/.test(text))).toEqual([]);
});

const route = () => new URL("recipes/multi-step", fixtureUrl()).href;
const requestForm = (page: Page) => page.getByTestId("recipe-multi-step");

async function openPage(javaScriptEnabled = true) {
	context = await browser.newContext({ javaScriptEnabled });
	const page = await context.newPage();
	page.on("console", (message) => {
		if (message.type() === "warning" || message.type() === "error") {
			diagnostics.push(`${message.type()}: ${message.text()}`);
		}
	});
	page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
	await page.goto(route());
	if (javaScriptEnabled) await page.locator('form[data-hydrated="true"]').waitFor();
	return page;
}

async function contact(form: Locator) {
	await form.getByLabel("Full name", { exact: true }).fill("Ada Lovelace");
	await form.getByLabel("Email", { exact: true }).fill("ada@example.com");
}
async function focused(control: Locator) {
	await expect
		.poll(() => control.evaluate((element) => element === document.activeElement))
		.toBe(true);
}
async function submit(page: Page) {
	const [response] = await Promise.all([
		page.waitForResponse(
			(candidate) =>
				candidate.request().method() === "POST" &&
				new URL(candidate.url()).pathname === new URL(route()).pathname
		),
		requestForm(page).getByRole("button", { name: "Submit request", exact: true }).click(),
	]);
	expect(response.request().isNavigationRequest()).toBe(false);
	return response.json();
}

// These exercise the consumer route, actual Superforms validation and real server actions.
describe("conditional multi-step requests", () => {
	it("shows all fields without JavaScript and rejects incomplete native requests", async () => {
		const page = await openPage(false);
		const form = requestForm(page);
		for (const label of [
			"Full name",
			"Email",
			"Request type",
			"Company name",
			"Request details",
		]) {
			expect(await form.getByLabel(label, { exact: true }).isVisible()).toBe(true);
		}
		await contact(form);
		await form.getByLabel("Request type", { exact: true }).selectOption("business");
		await form.getByLabel("Request details", { exact: true }).fill("Please contact our team.");
		const [response] = await Promise.all([
			page.waitForNavigation(),
			form.getByRole("button", { name: "Submit request", exact: true }).click(),
		]);
		expect(response?.status()).toBe(400);
		const companyId = await requestForm(page)
			.getByLabel("Company name", { exact: true })
			.getAttribute("id");
		expect(
			await page.getByTestId("multi-step-errors").getByRole("link").getAttribute("href")
		).toBe(`#${companyId}`);
		expect(await requestForm(page).getByLabel("Full name", { exact: true }).inputValue()).toBe(
			"Ada Lovelace"
		);
		expect(await page.getByTestId("multi-step-success").count()).toBe(0);
	});

	it("accepts a complete native request only after server validation", async () => {
		const page = await openPage(false);
		const form = requestForm(page);
		await contact(form);
		await form.getByLabel("Request type", { exact: true }).selectOption("business");
		await form.getByLabel("Company name", { exact: true }).fill("Analytical Engines");
		await form.getByLabel("Request details", { exact: true }).fill("Please contact our team.");
		const [response] = await Promise.all([
			page.waitForNavigation(),
			form.getByRole("button", { name: "Submit request", exact: true }).click(),
		]);
		expect(response?.status()).toBe(200);
		expect(await page.getByTestId("multi-step-errors").count()).toBe(0);
		expect(await page.getByTestId("multi-step-success").count()).toBe(1);
		expect(
			await requestForm(page).getByLabel("Company name", { exact: true }).inputValue()
		).toBe("Analytical Engines");
	});

	it("blocks invalid advance, makes Enter validate the current step, and preserves values on Back", async () => {
		const page = await openPage();
		const form = requestForm(page);
		let posts = 0;
		page.on("request", (request) => {
			if (request.method() === "POST") posts += 1;
		});
		await form.getByRole("button", { name: "Next", exact: true }).click();
		await page.getByTestId("multi-step-errors").waitFor();
		expect(await form.getByLabel("Full name", { exact: true }).isVisible()).toBe(true);
		expect(await form.getByLabel("Request details", { exact: true }).isVisible()).toBe(false);
		await contact(form);
		await form.getByLabel("Email", { exact: true }).press("Enter");
		await focused(form.getByRole("heading", { name: "Details", exact: true }));
		await form
			.getByLabel("Request details", { exact: true })
			.fill("I need help with this request.");
		await form.getByRole("button", { name: "Back", exact: true }).click();
		await focused(form.getByRole("heading", { name: "Contact", exact: true }));
		expect(await form.getByLabel("Full name", { exact: true }).inputValue()).toBe(
			"Ada Lovelace"
		);
		expect(await form.getByLabel("Email", { exact: true }).inputValue()).toBe(
			"ada@example.com"
		);
		await form.getByRole("button", { name: "Next", exact: true }).click();
		await focused(form.getByRole("heading", { name: "Details", exact: true }));
		expect(await form.getByLabel("Request details", { exact: true }).inputValue()).toBe(
			"I need help with this request."
		);
		expect(posts).toBe(0);
	});

	it("retains inactive values locally, transports hidden steps, and clears inactive company data on server acceptance", async () => {
		const page = await openPage();
		const form = requestForm(page);
		await contact(form);
		await form.getByRole("button", { name: "Next", exact: true }).click();
		await form.getByLabel("Request type", { exact: true }).selectOption("business");
		await form.getByLabel("Company name", { exact: true }).fill("Retained Company");
		await form.getByLabel("Request type", { exact: true }).selectOption("personal");
		expect(await form.getByLabel("Company name", { exact: true }).isVisible()).toBe(false);
		await form.getByLabel("Request type", { exact: true }).selectOption("business");
		expect(await form.getByLabel("Company name", { exact: true }).inputValue()).toBe(
			"Retained Company"
		);
		await form.getByLabel("Request type", { exact: true }).selectOption("personal");
		await form
			.getByLabel("Request details", { exact: true })
			.fill("Please validate this complete request.");
		await form.getByRole("button", { name: "Next", exact: true }).click();
		await focused(form.getByRole("heading", { name: "Review", exact: true }));
		const transported = await form.evaluate((element) =>
			Object.fromEntries(new FormData(element as HTMLFormElement))
		);
		expect(transported).toMatchObject({
			name: "Ada Lovelace",
			email: "ada@example.com",
			kind: "personal",
			company: "Retained Company",
			notes: "Please validate this complete request.",
		});
		expect(await submit(page)).toMatchObject({ type: "success", status: 200 });
		await page.getByTestId("multi-step-success").waitFor();
		expect(await form.getByLabel("Company name", { exact: true }).inputValue()).toBe("");
		await form.getByRole("button", { name: "Start again", exact: true }).click();
		await focused(form.getByRole("heading", { name: "Contact", exact: true }));
		expect(await form.getByLabel("Full name", { exact: true }).inputValue()).toBe("");
		expect(await page.getByTestId("multi-step-success").count()).toBe(0);
	});

	it("reveals the owning step and collapsed conditional section before focusing a summary target", async () => {
		const page = await openPage();
		const form = requestForm(page);
		await contact(form);
		await form.getByRole("button", { name: "Next", exact: true }).click();
		await form.getByLabel("Request type", { exact: true }).selectOption("business");
		await form.getByLabel("Request details", { exact: true }).fill("Please contact our team.");
		await form.getByRole("button", { name: "Next", exact: true }).click();
		const link = page.getByTestId("multi-step-errors").getByRole("link");
		await link.waitFor();
		await form.getByText("Business details", { exact: true }).click();
		await form.getByRole("button", { name: "Back", exact: true }).click();
		expect(await form.getByLabel("Company name", { exact: true }).isVisible()).toBe(false);
		await link.focus();
		await link.press("Enter");
		await focused(form.getByLabel("Company name", { exact: true }));
		expect(await form.getByLabel("Company name", { exact: true }).isVisible()).toBe(true);
		expect(await form.locator("details").getAttribute("open")).not.toBeNull();
	});

	it("rejects forged final requests independently of client steps and valid flags", async () => {
		await openPage(false);
		const forgedRequests: Record<string, string>[] = [
			{
				name: "Ada Lovelace",
				email: "ada@example.com",
				kind: "business",
				notes: "A complete description.",
				company: "",
				valid: "true",
				step: "review",
			},
			{ kind: "personal", valid: "true", step: "review" },
			{
				name: "Ada Lovelace",
				email: "ada@example.com",
				kind: "forged",
				notes: "A complete description.",
				valid: "true",
				step: "review",
			},
		];
		for (const data of forgedRequests) {
			const response = await context!.request.post(route(), {
				headers: { accept: "text/html", origin: new URL(route()).origin },
				multipart: data,
			});
			expect(response.status()).toBe(400);
			expect(await response.text()).not.toContain('data-testid="multi-step-success"');
		}
	});
});
