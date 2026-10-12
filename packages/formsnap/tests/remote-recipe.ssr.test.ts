import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { fixtureUrl } from "./fixture-url.js";
import { danglingReferences, duplicateIds, parseDocument } from "./html.js";

/**
 * Route-level coverage for the native remote-form recipe at /recipes/remote. Native submissions are
 * a real page POST carrying `Accept: text/html`; the enhanced ones run in a hydrated page. Both
 * transports the recipe documents are exercised against the running dev server.
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
	// A remote form reports a rejection by rendering issues into the page, so no request is expected
	// to fail: every browser warning, error and uncaught exception is a failure.
	expect(diagnostics).toEqual([]);
});

const url = () => new URL("recipes/remote", fixtureUrl()).href;
/** The enhanced transport posts to the app's remote endpoint, not to the page URL. */
const remoteEndpoint = () => (response: { url(): string; request(): { method(): string } }) =>
	response.request().method() === "POST" && /\/_app\/remote\//.test(response.url());
const form = (page: Page) => page.locator('form[data-testid="recipe-remote"]');
const password = (page: Page) => page.getByTestId("remote-recipe-password-input");

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

/** The values a valid submission needs, leaving the rendered defaults for the rest. */
async function fillValid(page: Page, overrides: { title?: string; postcode?: string } = {}) {
	await page.getByLabel("Order title").fill(overrides.title ?? "Team digest");
	await page.getByLabel("Seats").fill("4");
	await page.getByLabel("Account password").fill("formsnap");
	if (overrides.postcode !== undefined) {
		await page.getByLabel("Method").selectOption("courier");
		await page.getByLabel("Postcode").fill(overrides.postcode);
	}
}

function fieldErrors(page: Page) {
	return form(page).locator("[data-fs-field-error]").allTextContents();
}

describe("native remote recipe", () => {
	it("renders labels, associations and unique ids without JavaScript", async () => {
		const page = await openPage(false);
		const response = await page.goto(url());
		expect(response?.status()).toBe(200);

		const document = parseDocument(await page.content());
		expect(duplicateIds(document)).toEqual([]);
		expect(danglingReferences(document)).toEqual([]);
		for (const control of document.querySelectorAll("form input, form select")) {
			const id = control.getAttribute("id");
			expect(id, `id for ${control.getAttribute("name")}`).toBeTruthy();
			expect(document.querySelector(`label[for="${id}"]`)).not.toBeNull();
		}

		// One transport name for the choice group's three controls, and a distinct identity per
		// control, which is what keeps the associations unique inside one field.
		const channelNames = [...document.querySelectorAll('input[type="checkbox"]')]
			.map((input) => input.getAttribute("name"))
			.filter((name) => name?.startsWith("channels[]"));
		expect(channelNames).toHaveLength(3);
		expect(new Set(channelNames).size).toBe(1);

		// An explicit constraint produces required-state metadata, never native validation.
		const titleInput = document.querySelector('[data-testid="remote-recipe-title-input"]');
		expect(titleInput?.getAttribute("aria-required")).toBe("true");
		expect(titleInput?.hasAttribute("required")).toBe(false);
		expect(document.querySelector('label[for="remote-recipe-title"]')).not.toBeNull();

		// The rendered edit defaults are the page's contract with the user, not the schema's values.
		expect(titleInput?.getAttribute("value")).toBe("Monthly digest");
		expect(
			document
				.querySelector('[data-testid="remote-recipe-channel-push"]')
				?.hasAttribute("checked")
		).toBe(true);
		expect(
			document
				.querySelector('[data-testid="remote-recipe-channel-sms"]')
				?.hasAttribute("checked")
		).toBe(false);
	});

	it("submits natively and reaches the handler with the coerced values", async () => {
		const page = await openPage(false);
		await page.goto(url());
		await fillValid(page);
		await page.getByTestId("remote-recipe-notifications-input").uncheck();

		const [response] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Save order" }).click(),
		]);
		expect(response?.status()).toBe(200);
		const message = await page.getByTestId("remote-recipe-message").innerText();
		// The handler only knows these values if the transport arrived coerced and typed.
		expect(message).toContain("Team digest");
		expect(message).toContain("4 seats");
		expect(message).toContain("pickup");
		expect(message).toContain("email, push");
		// An accepted native response bonds no input, so the page renders its defaults again. The
		// server echoes input only alongside issues, which is why the native path cannot retain it.
		expect(await page.getByLabel("Order title").inputValue()).toBe("Monthly digest");
		expect(await page.getByLabel("Seats").inputValue()).toBe("3");
		expect(await page.getByTestId("remote-recipe-notifications-input").isChecked()).toBe(true);
	});

	it("restores the typed values on a native rejection and reports field and group feedback", async () => {
		const page = await openPage(false);
		await page.goto(url());
		await page.getByLabel("Order title").fill("Reserved");
		await page.getByLabel("Seats").fill("9");
		await page.getByLabel("Account password").fill("formsnap");
		await page.getByTestId("remote-recipe-notifications-input").uncheck();
		await page.getByTestId("remote-recipe-channel-push").check();

		const [response] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Save order" }).click(),
		]);
		expect(response?.status()).toBe(200);

		// The handler's imperative issue, on the field the user has to change.
		expect(await fieldErrors(page)).toContain("That title is reserved.");
		expect(await page.getByTestId("remote-recipe-title-input").getAttribute("value")).toBe(
			"Reserved"
		);
		// Non-sensitive values survive a native rejection, including the untouched defaults.
		expect(await page.getByLabel("Seats").inputValue()).toBe("9");
		// An unchecked checkbox is absent from the submission, so a rejection cannot restore it and
		// the rendered default applies. This is the same HTML rule that makes schema booleans optional.
		expect(await page.getByTestId("remote-recipe-notifications-input").isChecked()).toBe(true);
		expect(await page.getByTestId("remote-recipe-channel-sms").isChecked()).toBe(false);

		// Group feedback: an unchecked choice group carries no value at all, and the group keeps the
		// selection it did submit.
		const groupPage = await openPage(false);
		await groupPage.goto(url());
		await groupPage.getByLabel("Order title").fill("Team digest");
		await groupPage.getByLabel("Account password").fill("formsnap");
		await groupPage.getByTestId("remote-recipe-channel-email").uncheck();
		await groupPage.getByTestId("remote-recipe-channel-push").uncheck();
		const [groupResponse] = await Promise.all([
			groupPage.waitForNavigation(),
			groupPage.getByRole("button", { name: "Save order" }).click(),
		]);
		expect(groupResponse?.status()).toBe(200);
		expect(await fieldErrors(groupPage)).toContain("Choose at least one channel.");
		expect(
			await groupPage.locator("#remote-recipe-channels").getAttribute("data-fs-error")
		).toBe("");
		expect(await groupPage.getByLabel("Order title").inputValue()).toBe("Team digest");
	});

	it("reports a path-less issue as form feedback and never echoes the sensitive field", async () => {
		const page = await openPage(false);
		await page.goto(url());
		await fillValid(page);
		await password(page).fill("wrong");

		const [response] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Save order" }).click(),
		]);
		expect(response?.status()).toBe(200);
		// The authorisation issue has no path, so it is rendered as form feedback rather than as an
		// error on one control.
		expect(await fieldErrors(page)).toEqual([]);
		expect(await page.getByTestId("remote-recipe-root-issues").innerText()).toContain(
			"That password does not match the order owner."
		);
		expect(await page.getByTestId("remote-recipe-title-input").getAttribute("value")).toBe(
			"Team digest"
		);
		// The sensitive field is never echoed back, so it cannot be restored from the response.
		expect(await password(page).inputValue()).toBe("");
	});

	it("reports the nested group constraint on the member that has to change", async () => {
		const page = await openPage(false);
		await page.goto(url());
		await fillValid(page, { postcode: "90210" });

		const [response] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Save order" }).click(),
		]);
		expect(response?.status()).toBe(200);
		expect(await fieldErrors(page)).toContain("A courier needs a four-digit postcode.");
		expect(await page.getByTestId("remote-recipe-postcode-input").inputValue()).toBe("90210");
		expect(await page.getByLabel("Method").inputValue()).toBe("courier");
	});

	it("announces a refused domain result natively without inventing field errors", async () => {
		const page = await openPage(false);
		await page.goto(url());
		await fillValid(page, { postcode: "9021" });

		const [response] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Save order" }).click(),
		]);
		expect(response?.status()).toBe(200);
		expect(await page.getByTestId("remote-recipe-refusal").innerText()).toContain(
			"does not deliver to the 9xxx postcode area"
		);
		expect(await fieldErrors(page)).toEqual([]);
	});

	it("keeps a refused domain result from resetting the enhanced form", async () => {
		const page = await openPage();
		let posted = 0;
		page.on("request", (request) => {
			if (request.method() === "POST") posted += 1;
		});
		await hydrated(page);
		await fillValid(page, { postcode: "9021" });

		const [response] = await Promise.all([
			page.waitForResponse(remoteEndpoint()),
			page.getByRole("button", { name: "Save order" }).click(),
		]);
		expect(response.status()).toBe(200);
		// One submission is one request: nothing adds a second enhancement or an action shim.
		expect(posted).toBe(1);
		expect(await page.getByTestId("remote-recipe-refusal").innerText()).toContain(
			"does not deliver to the 9xxx postcode area"
		);
		// The refusal carries no issues, so Kit's default enhancement would reset here. The recipe's
		// own decision keeps the values until the outcome is accepted.
		expect(await page.getByLabel("Order title").inputValue()).toBe("Team digest");
		expect(await page.getByTestId("remote-recipe-postcode-input").inputValue()).toBe("9021");
		expect(await password(page).inputValue()).toBe("formsnap");
	});

	it("announces success and resets to the rendered defaults only for the accepted outcome", async () => {
		const page = await openPage();
		await hydrated(page);
		await fillValid(page);
		await page.getByTestId("remote-recipe-notifications-input").uncheck();
		await page.getByLabel("Postcode").fill("1234");

		const [response] = await Promise.all([
			page.waitForResponse(remoteEndpoint()),
			page.getByRole("button", { name: "Save order" }).click(),
		]);
		expect(response.status()).toBe(200);
		expect(response.request().isNavigationRequest()).toBe(false);
		await expect
			.poll(() => page.getByTestId("remote-recipe-message").innerText(), { timeout: 10000 })
			.toContain("Team digest");

		// The reset restores what the page rendered, including the defaults the user never touched.
		await expect.poll(() => page.getByLabel("Order title").inputValue()).toBe("Monthly digest");
		expect(await page.getByLabel("Seats").inputValue()).toBe("3");
		expect(await page.getByTestId("remote-recipe-notifications-input").isChecked()).toBe(true);
		expect(await page.getByTestId("remote-recipe-channel-email").isChecked()).toBe(true);
		expect(await page.getByTestId("remote-recipe-channel-push").isChecked()).toBe(true);
		expect(await page.getByTestId("remote-recipe-channel-sms").isChecked()).toBe(false);
		expect(await page.getByLabel("Method").inputValue()).toBe("pickup");
		expect(await page.getByTestId("remote-recipe-postcode-input").inputValue()).toBe("");
		expect(await password(page).inputValue()).toBe("");
		expect(await form(page).locator("[aria-invalid]").count()).toBe(0);
	});

	it("shows the pending state and disables the submit button while the request is in flight", async () => {
		const page = await openPage();
		let resume!: () => void;
		const gate = new Promise<void>((resolve) => {
			resume = resolve;
		});
		await page.route(/\/_app\/remote\//, async (route) => {
			if (route.request().method() !== "POST") return route.continue();
			await gate;
			await route.continue();
		});
		try {
			await hydrated(page);
			await fillValid(page);
			await page.getByRole("button", { name: "Save order" }).click();
			await page.getByTestId("remote-recipe-pending").waitFor();
			expect(await form(page).locator('button[type="submit"]').isDisabled()).toBe(true);
			resume();
			await page.getByTestId("remote-recipe-message").waitFor();
			expect(await page.getByTestId("remote-recipe-pending").count()).toBe(0);
		} finally {
			resume();
		}
	});
});
