import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { fixtureUrl } from "./fixture-url.js";
import { danglingReferences, duplicateIds, parseDocument } from "./html.js";
import { isRemoteEndpointRequest } from "./remote-endpoint.js";

/**
 * Route-level coverage for the command recipe at /recipes/remote-command. It is a JavaScript-dependent
 * integration, so most of it runs in a hydrated page; the page without JavaScript is checked for what
 * it honestly is: a form with no endpoint behind it.
 */

let browser: Browser;
let context: BrowserContext | undefined;
let diagnostics: string[];
/** Resource failures a test expects, such as the deliberate 500 from a failing command. */
let expectedDiagnostics: RegExp[];

beforeAll(async () => {
	browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
	await browser?.close();
});

beforeEach(() => {
	diagnostics = [];
	expectedDiagnostics = [];
});

afterEach(async () => {
	await context?.close();
	context = undefined;
	// Every other browser warning, error and uncaught exception is a failure, and the message names
	// the ones that were not expected.
	const unexpected = diagnostics.filter(
		(text) => !expectedDiagnostics.some((allowed) => allowed.test(text))
	);
	expect(unexpected, unexpected.join("\n")).toEqual([]);
});

const url = () => new URL("recipes/remote-command", fixtureUrl()).href;
const form = (page: Page) => page.locator('form[data-testid="recipe-remote-command"]');
const list = (page: Page) => page.locator('[data-testid="command-list"]').innerText();

/**
 * The text of a region that may not be rendered at all. `innerText()` on a conditional element waits
 * for it to appear, which hides the difference between "no errors" and "still waiting".
 */
async function read(page: Page, testId: string) {
	const parts = await page.getByTestId(testId).allTextContents();
	return parts.join(" ").trim();
}

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

async function hydrated() {
	const page = await openPage();
	await page.goto(url());
	await form(page).and(page.locator('[data-hydrated="true"]')).waitFor();
	return page;
}

/** Places an order through the command and waits for the response that carries it. */
async function place(page: Page, options: { seats: number; note?: string }) {
	await page.getByTestId("command-seats-input").fill(String(options.seats));
	await page.getByTestId("command-note-input").fill(options.note ?? "");
	const [response] = await Promise.all([
		page.waitForResponse(isRemoteEndpointRequest),
		page.getByTestId("command-submit").click(),
	]);
	return response;
}

/** The id of the order the message reports, so the list can be checked against it. */
async function reportedOrder(page: Page) {
	const message = await read(page, "command-message");
	const match = /Placed (order-\d+)\./.exec(message);
	if (!match) throw new Error(`the message does not report an order: ${message}`);
	return match[1];
}

describe("remote command recipe", () => {
	it("renders an ordinary Superform with no endpoint behind it", async () => {
		const page = await openPage(false);
		const response = await page.goto(url());
		expect(response?.status()).toBe(200);

		const document = parseDocument(await page.content());
		expect(duplicateIds(document)).toEqual([]);
		expect(danglingReferences(document)).toEqual([]);
		// Nothing in the form points at an action: this recipe has no no-JavaScript fallback, and it
		// says so rather than implying that method="POST" creates one.
		expect(document.querySelector("form")?.getAttribute("action")).toBeNull();
		expect(document.querySelector('[data-testid="command-js-note"]')?.textContent).toContain(
			"JavaScript is required"
		);
		for (const control of document.querySelectorAll("form input, form select")) {
			const id = control.getAttribute("id");
			expect(id, `id for ${control.getAttribute("name")}`).toBeTruthy();
			expect(document.querySelector(`label[for="${id}"]`)).not.toBeNull();
		}
		// Without JavaScript there is nothing to submit to: the browser posts the form to the page
		// itself, and Kit answers that there is no such action. That is the honest boundary of this
		// recipe, which is why it labels itself JavaScript-dependent.
		expectedDiagnostics.push(/Failed to load resource:.*405/);
		const [posted] = await Promise.all([
			page.waitForNavigation({ timeout: 10000 }),
			page.getByTestId("command-submit").click(),
		]);
		// The browser left the recipe's page for Kit's error page, so nothing was placed and there is no
		// list to read any more.
		expect(posted?.status()).toBe(405);
		expect(await page.getByTestId("command-list").count()).toBe(0);
	});

	it("places the order through the command and refreshes the query it shows", async () => {
		const page = await hydrated();
		const response = await place(page, { seats: 3, note: "first" });
		expect(response.status()).toBe(200);

		// The message is Superforms' own store, set from the translated result.
		const id = await reportedOrder(page);
		// The mutation is observable: the list is a query that was asked again, and it carries the order
		// the server actually stored.
		await expect.poll(() => list(page), { timeout: 10000 }).toContain(`${id}: 3 seats`);
		expect(await page.getByTestId("command-receipt").count()).toBe(1);
		// A successful submission resets the form to the values its load produced.
		await expect.poll(() => page.getByTestId("command-seats-input").inputValue()).toBe("1");
		expect(await page.getByTestId("command-pending").count()).toBe(0);
		expect(await page.getByTestId("command-submit").isDisabled()).toBe(false);
	});

	it("reports the server's refusal as a Superforms field error and keeps the values", async () => {
		const page = await hydrated();
		const before = await list(page);
		const response = await place(page, { seats: 20 });
		expect(response.status()).toBe(200);

		// The plan limit is the server's, and the translation puts it on the control it belongs to.
		await expect
			.poll(() => read(page, "command-seats-errors"), { timeout: 10000 })
			.toContain("The starter plan allows at most 5 seats.");
		expect(await page.getByTestId("command-seats-input").inputValue()).toBe("20");
		expect(await read(page, "command-form-errors")).toBe("");
		// Nothing was placed.
		expect(await list(page)).toBe(before);
		expect(await page.getByTestId("command-receipt").count()).toBe(0);
	});

	it("refuses a plan the account is not entitled to, on the control that asked for it", async () => {
		const page = await hydrated();
		const before = await list(page);
		await page.getByTestId("command-plan-select").selectOption("pro");
		await page.getByTestId("command-seats-input").fill("3");

		// Authorisation is the server's decision: the form offers both plans, and the account decides
		// which one it may have. The refusal lands on the control the user has to change.
		const [response] = await Promise.all([
			page.waitForResponse(isRemoteEndpointRequest),
			page.getByTestId("command-submit").click(),
		]);
		expect(response.status()).toBe(200);
		await expect
			.poll(() => read(page, "command-plan-errors"), { timeout: 10000 })
			.toContain("This account is on the starter plan.");
		expect(await page.getByTestId("command-plan-select").inputValue()).toBe("pro");
		expect(await list(page)).toBe(before);
	});

	it("reports a refusal that belongs to no control as a form-level error", async () => {
		const page = await hydrated();
		await place(page, { seats: 4, note: "duplicate" });
		await reportedOrder(page);

		// The same order again: the store refuses it, and nothing in the form needs correcting, so the
		// translation makes it a form-level error rather than an invented field issue.
		await place(page, { seats: 4, note: "duplicate" });
		await expect
			.poll(() => read(page, "command-form-errors"), { timeout: 10000 })
			.toContain("That order was just placed. Change something first.");
		expect(await read(page, "command-seats-errors")).toBe("");
		expect(await page.getByTestId("command-seats-input").inputValue()).toBe("4");
	});

	it("leaves no pending state behind when the command fails", async () => {
		const page = await hydrated();
		// The note makes the store throw: an unexpected failure is a failed request, not field feedback.
		// The command's failure travels in its response body, so the request itself still answers.
		await place(page, { seats: 2, note: "unreachable" });
		await expect
			.poll(() => read(page, "command-failure"), { timeout: 10000 })
			.toContain("The order service refused the request");
		// The submission is finished: Superforms' default error handler would have thrown here and left
		// the form permanently busy.
		expect(await page.getByTestId("command-pending").count()).toBe(0);
		expect(await page.getByTestId("command-submit").isDisabled()).toBe(false);
		expect(await page.getByTestId("command-seats-input").inputValue()).toBe("2");
	});

	it("clears a failed command's refusal on an accepted retry on the same page", async () => {
		const page = await hydrated();
		await place(page, { seats: 2, note: "unreachable" });
		await expect
			.poll(() => read(page, "command-failure"), { timeout: 10000 })
			.toContain("Nothing was placed.");

		await place(page, { seats: 3, note: "accepted retry" });
		await expect
			.poll(() => read(page, "command-message"), { timeout: 10000 })
			.toMatch(/Placed order-\d+\./);
		const id = await reportedOrder(page);
		await expect.poll(() => list(page), { timeout: 10000 }).toContain(`${id}: 3 seats`);
		expect(await read(page, "command-failure")).toBe("");
		expect(await page.getByTestId("command-seats-input").inputValue()).toBe("1");
		expect(await page.getByTestId("command-pending").count()).toBe(0);
	});

	it("preserves acceptance, reset and receipt when refreshing the order list fails", async () => {
		const page = await hydrated();
		// Complete a real first mutation so no initial query can race with the failed refresh.
		await place(page, { seats: 1, note: "before failed refresh" });
		await page.getByTestId("command-message").waitFor();
		const first = await reportedOrder(page);
		await expect.poll(() => list(page), { timeout: 10000 }).toContain(`${first}: 1 seats`);
		await expect
			.poll(() => page.getByTestId("command-pending").count(), { timeout: 10000 })
			.toBe(0);
		const before = await list(page);
		expectedDiagnostics.push(/Failed to load resource:.*503/);
		let refreshes = 0;
		await page.route("**/_app/remote/**", async (route) => {
			if (route.request().method() !== "GET") return route.continue();
			refreshes += 1;
			await route.fulfill({
				status: 503,
				contentType: "application/json",
				body: JSON.stringify({ message: "Order list unavailable" }),
			});
		});

		await place(page, { seats: 3, note: "accepted despite stale list" });
		await expect
			.poll(() => read(page, "command-message"), { timeout: 10000 })
			.not.toBe(`Placed ${first}.`);
		await expect
			.poll(() => read(page, "command-message"), { timeout: 10000 })
			.toMatch(/Placed order-\d+\./);
		const id = await reportedOrder(page);
		expect(id).not.toBe(first);
		expect(refreshes).toBe(1);
		expect(await list(page)).toBe(before);
		expect(await read(page, "command-failure")).toBe("");
		expect(await read(page, "command-refresh-failure")).toContain(
			"The order was placed, but the list could not be refreshed."
		);
		expect(await page.getByTestId("command-seats-input").inputValue()).toBe("1");
		expect(await page.getByTestId("command-pending").count()).toBe(0);
		expect(await page.getByTestId("command-submit").isDisabled()).toBe(false);

		await page.unroute("**/_app/remote/**");
		await page.getByTestId("command-receipt").click();
		await expect
			.poll(() => page.getByTestId("receipt-summary").innerText(), { timeout: 10000 })
			.toBe(`${id}: 3 seats on the starter plan.`);
	});

	it("shows the pending state while the command is in flight", async () => {
		const page = await hydrated();
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route(/\/_app\/remote\//, async (route) => {
			if (route.request().method() !== "POST") return route.continue();
			await gate;
			await route.continue();
		});
		try {
			await page.getByTestId("command-seats-input").fill("2");
			await page.getByTestId("command-submit").click();
			await page.getByTestId("command-pending").waitFor();
			expect(await page.getByTestId("command-submit").isDisabled()).toBe(true);
			release();
			await page.getByTestId("command-message").waitFor();
			expect(await page.getByTestId("command-pending").count()).toBe(0);
		} finally {
			release();
		}
	});

	it("reports a command schema failure as a server failure rather than field issues", async () => {
		const page = await hydrated();
		await page.getByTestId("command-invalid").click();
		await expect
			.poll(() => read(page, "command-failure"), { timeout: 10000 })
			.toContain("The command rejected the payload before its handler ran");
		// The command's own schema is not native field validation, so nothing here is advertised as an
		// issue on a control.
		expect(await read(page, "command-seats-errors")).toBe("");
		expect(await read(page, "command-form-errors")).toBe("");
	});

	it("navigates to the receipt the application owns", async () => {
		const page = await hydrated();
		await place(page, { seats: 5, note: "receipt" });
		const id = await reportedOrder(page);

		// A command cannot redirect, so the navigation is the application's: the link goes to a route
		// whose own load reads the stored order.
		await page.getByTestId("command-receipt").click();
		await expect
			.poll(() => page.getByTestId("receipt-summary").innerText(), { timeout: 10000 })
			.toBe(`${id}: 5 seats on the starter plan.`);
		await page.getByTestId("receipt-back").click();
		await form(page).and(page.locator('[data-hydrated="true"]')).waitFor();
		// The order is still there, because it was never a client-side claim.
		expect(await list(page)).toContain(`${id}: 5 seats`);
	});
});
