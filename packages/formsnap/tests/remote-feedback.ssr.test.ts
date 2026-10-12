import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { fixtureUrl } from "./fixture-url.js";
import { isRemoteEndpointRequest } from "./remote-endpoint.js";
import { danglingReferences, duplicateIds, parseDocument } from "./html.js";

/**
 * Route-level coverage for the feedback recipe at /recipes/remote-feedback. Each rejection layer the
 * recipe documents is exercised through the layer that actually produces it, in a hydrated page or
 * in a page without JavaScript. Automated checks cover the markup and the interactions; what an
 * assistive technology says is a manual observation and is not asserted here.
 */

let browser: Browser;
let context: BrowserContext | undefined;
let diagnostics: string[];
/** Resource failures a test expects, such as the deliberately thrown handler. */
let expectedResourceFailures: RegExp[];

beforeAll(async () => {
	browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
	await browser?.close();
});

beforeEach(() => {
	diagnostics = [];
	expectedResourceFailures = [];
});

afterEach(async () => {
	await context?.close();
	context = undefined;
	// Every other browser warning, error and uncaught exception is a failure.
	expect(
		diagnostics.filter(
			(text) => !expectedResourceFailures.some((allowed) => allowed.test(text))
		)
	).toEqual([]);
});

const url = () => new URL("recipes/remote-feedback", fixtureUrl()).href;
const form = (page: Page) => page.locator('form[data-testid="recipe-remote-feedback"]');
const summary = (page: Page, path: string) => page.getByTestId(`feedback-summary-${path}`);

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

/** Open the recipe and wait until the browser has hydrated the remote form. */
async function hydrated(page: Page) {
	await page.goto(url());
	await form(page).and(page.locator('[data-hydrated="true"]')).waitFor();
}

/** The values a valid submission needs. */
async function fillValid(page: Page, handle = "team_digest") {
	await page.getByTestId("feedback-handle-input").fill(handle);
	await page.getByTestId("feedback-seats-input").fill("2");
	await page.getByTestId("feedback-channel-email").check();
	await page.getByTestId("feedback-password-input").fill("formsnap");
}

async function submit(page: Page) {
	return Promise.all([
		page.waitForResponse(isRemoteEndpointRequest),
		page.getByRole("button", { name: "Save order" }).click(),
	]).then(([response]) => response);
}

function inlineErrors(page: Page) {
	return form(page).locator("[data-fs-field-error]").allTextContents();
}

describe("remote feedback recipe", () => {
	it("blocks a native constraint failure in the browser, before any request", async () => {
		const page = await openPage();
		let posted = 0;
		page.on("request", (request) => {
			if (request.method() === "POST") posted += 1;
		});
		await hydrated(page);
		await fillValid(page, "");
		await page.getByRole("button", { name: "Save order" }).click();

		// The page renders its own native constraint, so the browser refuses to submit and the
		// preflight pass, the request and the server are never reached.
		expect(
			await page
				.getByTestId("feedback-handle-input")
				.evaluate((element: HTMLInputElement) => element.validity.valueMissing)
		).toBe(true);
		expect(posted).toBe(0);
		expect(await summary(page, "handle").count()).toBe(0);

		await page.getByTestId("feedback-handle-input").fill("team digest");
		await page.getByRole("button", { name: "Save order" }).click();
		expect(
			await page
				.getByTestId("feedback-handle-input")
				.evaluate((element: HTMLInputElement) => element.validity.patternMismatch)
		).toBe(true);
		expect(posted).toBe(0);
	});

	it("reports a preflight failure without a request, from outside an enhancement callback", async () => {
		const page = await openPage();
		let posted = 0;
		page.on("request", (request) => {
			if (request.method() === "POST") posted += 1;
		});
		await hydrated(page);
		await fillValid(page);
		await page.getByTestId("feedback-seats-input").fill("0");
		await page.getByRole("button", { name: "Save order" }).click();

		// A preflight failure returns before the enhancement callback, so this feedback can only come
		// from the form's own issue state, and the pending state it started still has to finish.
		expect(posted).toBe(0);
		await expect
			.poll(() => summary(page, "seats").innerText(), { timeout: 10000 })
			.toContain("Book at least one seat.");
		await expect
			.poll(() => inlineErrors(page), { timeout: 10000 })
			.toContain("Book at least one seat.");
		await expect
			.poll(() => page.getByTestId("feedback-pending").count(), { timeout: 10000 })
			.toBe(0);
		expect(await form(page).locator('button[type="submit"]').isDisabled()).toBe(false);

		// A group-only preflight failure is reported the same way, and its target is the group's own
		// first control rather than a fabricated group id.
		await page.getByTestId("feedback-seats-input").fill("2");
		await page.getByTestId("feedback-channel-email").uncheck();
		await page.getByRole("button", { name: "Save order" }).click();
		expect(posted).toBe(0);
		await expect
			.poll(() => summary(page, "channels").innerText(), { timeout: 10000 })
			.toContain("Choose at least one channel.");
		expect(await summary(page, "channels").getAttribute("href")).toBe(
			"#feedback-channel-email"
		);
	});

	it("rejects a server-only schema issue, links it, and unlinks it when its control is removed", async () => {
		const page = await openPage();
		await hydrated(page);
		await fillValid(page);
		await page.getByTestId("feedback-notes-disclosure").locator("summary").click();
		await page.getByTestId("feedback-notes-input").fill("A note that is far too long.");
		const response = await submit(page);
		expect(response.status()).toBe(200);

		// The preflight pass does not check the note, so only the server's schema can reject it: the
		// issue reached the page from the response, not from client validation.
		await expect
			.poll(() => summary(page, "notes").innerText(), { timeout: 10000 })
			.toContain("Keep the notes to twenty characters.");
		expect(await summary(page, "notes").getAttribute("href")).toBe("#feedback-notes");
		expect(await page.getByTestId("feedback-notes-input").inputValue()).toBe(
			"A note that is far too long."
		);

		// A collapsed target is revealed before it is focused, and only the link's activation moves
		// focus: a rejection on its own leaves focus where the user put it.
		await page.getByTestId("feedback-notes-disclosure").locator("summary").click();
		expect(
			await page
				.getByTestId("feedback-notes-disclosure")
				.evaluate((element) => (element as HTMLDetailsElement).open)
		).toBe(false);
		await summary(page, "notes").click();
		expect(
			await page
				.getByTestId("feedback-notes-disclosure")
				.evaluate((element) => (element as HTMLDetailsElement).open)
		).toBe(true);
		expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))).toBe(
			"feedback-notes-input"
		);

		// Removing the conditional field takes its target with it, so the entry stays readable and
		// stops being a link instead of pointing at an element that is no longer mounted.
		await page.getByLabel("Record order notes").uncheck();
		await expect
			.poll(() => page.getByTestId("feedback-notes-input").count(), { timeout: 10000 })
			.toBe(0);
		expect(await summary(page, "notes").evaluate((element) => element.tagName)).toBe("SPAN");
		expect(await summary(page, "notes").innerText()).toContain(
			"Keep the notes to twenty characters."
		);
	});

	it("keeps focus unchanged on a rejection and reports a path-less issue without a link", async () => {
		const page = await openPage();
		await hydrated(page);
		await fillValid(page, "reserved");
		// Submit from the keyboard while another control holds focus, so "unchanged" is observable.
		const seats = page.getByTestId("feedback-seats-input");
		const [response] = await Promise.all([
			page.waitForResponse(isRemoteEndpointRequest),
			seats.press("Enter"),
		]);
		expect(response.status()).toBe(200);
		await expect
			.poll(() => summary(page, "handle").innerText(), { timeout: 10000 })
			.toContain("That handle is reserved.");
		// Kit focuses nothing on a rejection, and neither does the recipe; the summary is where a
		// user chooses to go.
		expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))).toBe(
			"feedback-seats-input"
		);

		// Activating the entry is the only thing that moves focus, and it moves it to the mounted
		// control the path names.
		await summary(page, "handle").click();
		expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))).toBe(
			"feedback-handle-input"
		);

		// The authorisation issue has no path: it is form feedback, so its entry is not a link.
		const second = await openPage();
		await hydrated(second);
		await fillValid(second);
		await second.getByTestId("feedback-password-input").fill("wrong");
		const rejected = await submit(second);
		expect(rejected.status()).toBe(200);
		await expect
			.poll(() => summary(second, "root").innerText(), { timeout: 10000 })
			.toContain("That password does not match the order owner.");
		expect(await summary(second, "root").evaluate((element) => element.tagName)).toBe("SPAN");
		// On the enhanced path nothing replaces the DOM, so the value the user typed is still in the
		// field. Redaction is about what the server echoes, which is what a native reload renders.
		expect(await second.getByTestId("feedback-password-input").inputValue()).toBe("wrong");
		expect(await inlineErrors(second)).toEqual([]);
	});

	it("declines a domain result, keeps the values and announces it in the same region", async () => {
		const page = await openPage();
		await hydrated(page);
		await fillValid(page, "weekly");
		await page.getByTestId("feedback-seats-input").fill("5");
		const response = await submit(page);
		expect(response.status()).toBe(200);

		await expect
			.poll(() => page.getByTestId("feedback-declined").innerText(), { timeout: 10000 })
			.toContain("Only 4 seats are left for weekly.");
		// A refused result carries no issues, so Kit would reset by default. The recipe keeps the
		// values, and the outcome is announced by the one region that also holds the summary.
		expect(await summary(page, "seats").count()).toBe(0);
		expect(await page.getByTestId("feedback-seats-input").inputValue()).toBe("5");
		expect(await page.getByTestId("feedback-handle-input").inputValue()).toBe("weekly");
		expect(await page.getByTestId("feedback-password-input").inputValue()).toBe("formsnap");
	});

	it("surfaces an unexpected failure through the error boundary and leaves no pending state", async () => {
		const page = await openPage();
		expectedResourceFailures.push(/Failed to load resource:.*500/);
		await hydrated(page);
		await fillValid(page, "explode");
		await page.getByRole("button", { name: "Save order" }).click();

		// A thrown handler is not a validation outcome: the route's error boundary replaces the form,
		// and the text the browser is told is the sanitized one. The handler's own message stays in
		// the server log, because mapping an error to a client-safe message is `handleError`'s job.
		await expect
			.poll(() => page.getByTestId("feedback-error").innerText(), { timeout: 10000 })
			.toBe("Internal Error");
		expect(await form(page).count()).toBe(0);
		expect(await summary(page, "handle").count()).toBe(0);

		// The boundary replaced the route, so no pending state is left behind, and the page the user
		// returns to is usable again.
		expect(await page.getByTestId("feedback-pending").count()).toBe(0);
		await page.getByTestId("feedback-error-retry").click();
		await form(page).and(page.locator('[data-hydrated="true"]')).waitFor();
		expect(await form(page).locator('button[type="submit"]').isDisabled()).toBe(false);
	});

	it("keeps the server schema as the only validator without JavaScript", async () => {
		const page = await openPage(false);
		await page.goto(url());
		await fillValid(page);
		await page.getByTestId("feedback-notes-disclosure").locator("summary").click();
		await page.getByTestId("feedback-notes-input").fill("A note that is far too long.");

		const [response] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Save order" }).click(),
		]);
		expect(response?.status()).toBe(200);
		// No preflight pass runs without JavaScript, so this is the server schema's own rejection,
		// rendered into the same summary and the same inline container.
		expect(await summary(page, "notes").innerText()).toContain(
			"Keep the notes to twenty characters."
		);
		expect(await summary(page, "notes").getAttribute("href")).toBe("#feedback-notes");
		expect(await inlineErrors(page)).toContain("Keep the notes to twenty characters.");

		// The handler's own issues read the same way: one on a path, one with no path at all.
		const second = await openPage(false);
		await second.goto(url());
		await fillValid(second, "reserved");
		const [imperative] = await Promise.all([
			second.waitForNavigation(),
			second.getByRole("button", { name: "Save order" }).click(),
		]);
		expect(imperative?.status()).toBe(200);
		expect(await summary(second, "handle").innerText()).toContain("That handle is reserved.");

		const third = await openPage(false);
		await third.goto(url());
		await fillValid(third);
		await third.getByTestId("feedback-password-input").fill("wrong");
		const [root] = await Promise.all([
			third.waitForNavigation(),
			third.getByRole("button", { name: "Save order" }).click(),
		]);
		expect(root?.status()).toBe(200);
		expect(await summary(third, "root").evaluate((element) => element.tagName)).toBe("SPAN");
		expect(await third.getByTestId("feedback-password-input").inputValue()).toBe("");
	});

	it("renders one live region whose inline error containers stay silent", async () => {
		const page = await openPage(false);
		await page.goto(url());
		await fillValid(page, "reserved");
		const [response] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Save order" }).click(),
		]);
		expect(response?.status()).toBe(200);

		const document = parseDocument(await page.content());
		expect(duplicateIds(document)).toEqual([]);
		expect(danglingReferences(document)).toEqual([]);

		// Exactly one live region announces, and the inline containers are associated descriptions
		// with the announcement policy off, so a rejection is not spoken twice.
		expect(
			[...document.querySelectorAll('[aria-live]:not([aria-live="off"])')].map((element) =>
				element.getAttribute("data-testid")
			)
		).toEqual(["feedback-announcement"]);
		const inline = [...document.querySelectorAll("[data-fs-field-errors]")];
		expect(inline.length).toBeGreaterThan(0);
		expect(inline.map((element) => element.getAttribute("aria-live"))).toEqual(
			inline.map(() => "off")
		);
		const handle = document.querySelector('[data-testid="feedback-handle-input"]');
		expect(handle?.getAttribute("aria-invalid")).toBe("true");
		const described = (handle?.getAttribute("aria-describedby") ?? "")
			.split(/\s+/)
			.filter(Boolean);
		expect(
			described.some((id) =>
				document.getElementById(id)?.hasAttribute("data-fs-field-errors")
			)
		).toBe(true);
	});
});
