import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { fixtureUrl } from "./fixture-url.js";

/**
 * What the browser computes from the associations, asserted through the roles and names a keyboard or
 * a screen reader actually uses rather than through the attributes that produced them. The routes are
 * covered without JavaScript, so the computed surface is the server-rendered one.
 *
 * This is DOM evidence, not speech evidence. A screen reader was not available on the machine this
 * was written on, so announcement order and duplicate speech were not observed; nothing here may be
 * read as a substitute for that manual check.
 */

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
	// Every warning, error and uncaught exception is a failure.
	expect(diagnostics).toEqual([]);
});

const url = (path: string) => new URL(`recipes/${path}`, fixtureUrl()).href;

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

describe("remote accessible surface", () => {
	it("names every control and group of the native remote recipe by its role", async () => {
		const page = await openPage(false);
		const response = await page.goto(url("remote"));
		expect(response?.status()).toBe(200);

		// The name is the label text the browser computed for the control, so a label that stopped
		// naming its control would fail here even if the markup still looked associated.
		expect(await page.getByRole("textbox", { name: "Order title", exact: true }).count()).toBe(
			1
		);
		expect(await page.getByRole("spinbutton", { name: "Seats", exact: true }).count()).toBe(1);
		expect(
			await page
				.getByRole("checkbox", { name: "Send a notification when the order changes" })
				.count()
		).toBe(1);
		expect(
			await page.getByRole("textbox", { name: "Account password", exact: true }).count()
		).toBe(1);

		// A fieldset names its group through its legend, and each option keeps its own name inside it.
		const channels = page.getByRole("group", { name: "Channels", exact: true });
		expect(await channels.count()).toBe(1);
		for (const option of ["Email", "SMS", "Push"]) {
			expect(
				await channels.getByRole("checkbox", { name: option, exact: true }).count(),
				`the ${option} option is named`
			).toBe(1);
		}
		const delivery = page.getByRole("group", { name: "Delivery", exact: true });
		expect(await delivery.getByRole("combobox", { name: "Method", exact: true }).count()).toBe(
			1
		);
		expect(await delivery.getByRole("textbox", { name: "Postcode", exact: true }).count()).toBe(
			1
		);

		expect(await page.getByRole("button", { name: "Save order", exact: true }).count()).toBe(1);
	});

	it("computes an accessible description for a control from its own described-by list", async () => {
		const page = await openPage(false);
		await page.goto(url("remote"));

		const title = page.getByRole("textbox", { name: "Order title", exact: true });
		const described = (await title.getAttribute("aria-describedby")) ?? "";
		const text = await page.evaluate(
			(ids) =>
				ids
					.map((id) => document.getElementById(id)?.textContent ?? "")
					.join(" ")
					.trim(),
			described.split(/\s+/).filter(Boolean)
		);
		expect(text).toContain("Three to forty characters.");
		// The required state is stated for assistive technology without a native constraint.
		expect(await title.getAttribute("aria-required")).toBe("true");
	});

	it("offers the summary entry as a link and activates it from the keyboard", async () => {
		const page = await openPage();
		await page.goto(url("remote-feedback"));
		const form = page.locator('form[data-testid="recipe-remote-feedback"]');
		await form.and(page.locator('[data-hydrated="true"]')).waitFor();
		await page.locator('[data-testid="feedback-handle-input"]').fill("reserved");
		await page.locator('[data-testid="feedback-seats-input"]').fill("2");
		await page.locator('[data-testid="feedback-channel-email"]').check();
		await page.locator('[data-testid="feedback-password-input"]').fill("formsnap");

		await Promise.all([
			page.waitForResponse(
				(response) =>
					response.request().method() === "POST" &&
					/\/_app\/remote\//.test(response.url())
			),
			page.locator('button[type="submit"]').click(),
		]);

		// The entry is a link whose name is the readable field name and the message, and it is reachable
		// by its role rather than by a test id.
		const entry = page.getByRole("link", {
			name: "Handle: That handle is reserved.",
			exact: true,
		});
		expect(await entry.count()).toBe(1);
		expect(await entry.getAttribute("href")).toBe("#feedback-handle");

		// Keyboard activation is what moves focus, and it moves it to the control the entry names.
		await entry.press("Enter");
		await expect
			.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-testid")), {
				timeout: 10000,
			})
			.toBe("feedback-handle-input");

		// A path-less issue belongs to no control, so it is text rather than a link in the same summary.
		await page.locator('[data-testid="feedback-password-input"]').fill("wrong");
		await Promise.all([
			page.waitForResponse(
				(response) =>
					response.request().method() === "POST" &&
					/\/_app\/remote\//.test(response.url())
			),
			page.locator('button[type="submit"]').click(),
		]);
		const root = page.locator('[data-testid="feedback-summary-root"]');
		await expect
			.poll(() => root.innerText(), { timeout: 10000 })
			.toContain("That password does not match the order owner.");
		expect(await root.evaluate((element) => element.tagName)).toBe("SPAN");
	});
});
