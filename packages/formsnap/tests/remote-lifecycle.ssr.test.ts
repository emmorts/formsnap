import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { fixtureUrl } from "./fixture-url.js";
import { isRemoteEndpointRequest } from "./remote-endpoint.js";
import { danglingReferences, duplicateIds, parseDocument } from "./html.js";

/**
 * The consumer behaviour the remote recipes share, asserted once per contract rather than per recipe:
 * server-rendered associations, hydration stability, one native rejection carrying all four rules,
 * a business rejection that shows up inline and in the summary, an issue rendered in exactly one
 * place each, and the pending presentation finishing on both a refusal and a rejection addressed to
 * a form that is off screen. Each recipe's own file keeps the coverage of what that recipe shows.
 */

let browser: Browser;
let context: BrowserContext | undefined;
let diagnostics: string[];
/** Warnings a test expects, such as Kit reporting that issues arrived while their form was off screen. */
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
	// Every warning, error and uncaught exception is a failure unless the test named it.
	expect(
		diagnostics.filter((text) => !expectedDiagnostics.some((allowed) => allowed.test(text)))
	).toEqual([]);
});

/** Every route that presents a remote form, with the test id its form carries. */
const routes = [
	{ path: "remote", form: "recipe-remote" },
	{ path: "remote-feedback", form: "recipe-remote-feedback" },
	{ path: "remote-instances", form: "order-line-line_a" },
	{ path: "remote-command", form: "recipe-remote-command" },
] as const;

const url = (path: string) => new URL(`recipes/${path}`, fixtureUrl()).href;
const form = (page: Page, testId: string) => page.locator(`form[data-testid="${testId}"]`);

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

/** Open a recipe and wait until the browser has hydrated its remote form. */
async function hydrated(page: Page, testId: string, path: string) {
	await page.goto(url(path));
	await form(page, testId).and(page.locator('[data-hydrated="true"]')).waitFor();
}

/** How many times a phrase occurs in a region's text, which is what "rendered once" means. */
async function occurrences(page: Page, selector: string, phrase: string) {
	const text = await page.locator(selector).evaluate((element) => element.textContent ?? "");
	return text.split(phrase).length - 1;
}

/** The error container a control points at, resolved through its own `aria-describedby`. */
async function errorContainerId(page: Page, testId: string) {
	const describedBy =
		(await page.locator(`[data-testid="${testId}"]`).getAttribute("aria-describedby")) ?? "";
	return page.evaluate(
		(candidates) =>
			candidates.find((id) =>
				document.getElementById(id)?.hasAttribute("data-fs-field-errors")
			) ?? null,
		describedBy.split(/\s+/).filter(Boolean)
	);
}

describe("remote consumer contracts", () => {
	it.each(routes)(
		"renders labels and resolving associations in the server HTML of /recipes/$path",
		async ({ path, form: testId }) => {
			const page = await openPage(false);
			const response = await page.goto(url(path));
			expect(response?.status()).toBe(200);

			const document = parseDocument(await page.content());
			expect(document.querySelector(`form[data-testid="${testId}"]`)).not.toBeNull();
			expect(duplicateIds(document)).toEqual([]);
			expect(danglingReferences(document)).toEqual([]);
			for (const control of document.querySelectorAll(
				"form input, form select, form textarea"
			)) {
				const id = control.getAttribute("id");
				expect(
					id,
					`id for ${control.getAttribute("name")} on /recipes/${path}`
				).toBeTruthy();
				expect(
					document.querySelector(`label[for="${id}"]`),
					`label for ${control.getAttribute("name")} on /recipes/${path}`
				).not.toBeNull();
			}
		}
	);

	it.each(routes)(
		"keeps ids, ARIA attributes and DOM nodes across hydration of /recipes/$path",
		async ({ path, form: testId }) => {
			const page = await openPage();
			let releaseScripts!: () => void;
			const scriptsReady = new Promise<void>((resolve) => {
				releaseScripts = resolve;
			});
			await page.route("**/*", async (route) => {
				if (route.request().resourceType() === "script") await scriptsReady;
				await route.continue();
			});
			try {
				const response = await page.goto(url(path), { waitUntil: "commit" });
				expect(response?.status()).toBe(200);
				const target = form(page, testId);
				await target.and(page.locator('[data-hydrated="false"]')).waitFor();
				const capture = () =>
					target.locator("[id]").evaluateAll((elements) =>
						elements.map((element) => ({
							tag: element.tagName,
							id: element.id,
							describedBy: element.getAttribute("aria-describedby"),
							invalid: element.getAttribute("aria-invalid"),
							required: element.getAttribute("aria-required"),
						}))
					);
				const before = await capture();
				await target.locator("[id]").evaluateAll((elements) => {
					(window as Window & { ssrNodes?: Element[] }).ssrNodes = elements;
				});
				releaseScripts();
				await target.and(page.locator('[data-hydrated="true"]')).waitFor();
				expect(await capture()).toEqual(before);
				expect(
					await target
						.locator("[id]")
						.evaluateAll((elements) =>
							elements.every(
								(element, index) =>
									element ===
									(window as Window & { ssrNodes?: Element[] }).ssrNodes?.[index]
							)
						)
				).toBe(true);
			} finally {
				releaseScripts();
			}
		}
	);

	it("carries the four rules of a native rejection at once", async () => {
		// The feedback recipe declares its error containers as owned content, so its controls reference
		// them in the server HTML. The remote recipe renders a standalone `FieldErrors`, which cannot be
		// associated without JavaScript — that is its own documented cost, not this contract.
		const page = await openPage(false);
		await page.goto(url("remote-feedback"));
		await page.locator('[data-testid="feedback-handle-input"]').fill("reserved");
		await page.locator('[data-testid="feedback-seats-input"]').fill("7");
		await page.locator('[data-testid="feedback-channel-email"]').check();
		await page.locator('[data-testid="feedback-password-input"]').fill("formsnap");

		const [response] = await Promise.all([
			page.waitForNavigation(),
			page.locator('button[type="submit"]').click(),
		]);
		expect(response?.status()).toBe(200);

		// The value the handler rejected survives the rejection, and so do the values the user did not
		// touch: only a checkbox that was left unchecked cannot come back, because it sends nothing.
		expect(
			await page.locator('[data-testid="feedback-handle-input"]').getAttribute("value")
		).toBe("reserved");
		expect(await page.locator('[data-testid="feedback-seats-input"]').inputValue()).toBe("7");
		expect(await page.locator('[data-testid="feedback-channel-email"]').isChecked()).toBe(true);
		// The sensitive field is never echoed, so the rejection cannot restore it.
		expect(await page.locator('[data-testid="feedback-password-input"]').inputValue()).toBe("");
		// The rejection is announced by the control's own error container, which the control references.
		const container = await errorContainerId(page, "feedback-handle-input");
		expect(container, "the rejected control references its error container").not.toBeNull();
		expect(await page.locator(`[id="${container}"]`).innerText()).toContain(
			"That handle is reserved."
		);
		expect(
			await page.locator('[data-testid="feedback-handle-input"]').getAttribute("aria-invalid")
		).toBe("true");
	});

	it("reports a business rejection inline and in one summary, keeping unrelated input", async () => {
		const page = await openPage();
		await hydrated(page, "recipe-remote-feedback", "remote-feedback");
		await page.locator('[data-testid="feedback-handle-input"]').fill("reserved");
		await page.locator('[data-testid="feedback-seats-input"]').fill("7");
		await page.locator('[data-testid="feedback-channel-email"]').check();
		await page.locator('[data-testid="feedback-password-input"]').fill("formsnap");

		const [response] = await Promise.all([
			page.waitForResponse(isRemoteEndpointRequest),
			page.locator('button[type="submit"]').click(),
		]);
		expect(response.status()).toBe(200);

		const summary = page.locator('[data-testid="feedback-summary-handle"]');
		await expect
			.poll(() => summary.innerText(), { timeout: 10000 })
			.toContain("That handle is reserved.");
		// The entry is a link because its target is mounted, and the target's own container carries the
		// same message, so a keyboard user can reach either.
		expect(await summary.getAttribute("href")).toBe("#feedback-handle");
		const container = await errorContainerId(page, "feedback-handle-input");
		expect(await page.locator(`[id="${container}"]`).innerText()).toContain(
			"That handle is reserved."
		);
		// The rejection did not touch anything else the user had entered.
		expect(await page.locator('[data-testid="feedback-seats-input"]').inputValue()).toBe("7");
		expect(await page.locator('[data-testid="feedback-channel-email"]').isChecked()).toBe(true);
	});

	it("renders each issue in one inline container and one summary entry, and never links a root one", async () => {
		const page = await openPage(false);
		await page.goto(url("remote-feedback"));
		await page.locator('[data-testid="feedback-handle-input"]').fill("reserved");
		await page.locator('[data-testid="feedback-seats-input"]').fill("2");
		await page.locator('[data-testid="feedback-channel-email"]').check();
		await page.locator('[data-testid="feedback-password-input"]').fill("formsnap");
		const [rejected] = await Promise.all([
			page.waitForNavigation(),
			page.locator('button[type="submit"]').click(),
		]);
		expect(rejected?.status()).toBe(200);

		// One inline occurrence, one aggregate occurrence: the form's own region does not restate what
		// the control's container already says, so a rejection is one message in two scopes.
		expect(
			await occurrences(
				page,
				'form[data-testid="recipe-remote-feedback"]',
				"That handle is reserved."
			)
		).toBe(2);
		expect(
			await occurrences(
				page,
				'[data-testid="feedback-announcement"]',
				"That handle is reserved."
			)
		).toBe(1);
		const container = await errorContainerId(page, "feedback-handle-input");
		expect(await occurrences(page, `[id="${container}"]`, "That handle is reserved.")).toBe(1);

		// A path-less issue belongs to no control, so its entry is text rather than a link and no field
		// container claims it.
		const second = await openPage(false);
		await second.goto(url("remote-feedback"));
		await second.locator('[data-testid="feedback-handle-input"]').fill("team_digest");
		await second.locator('[data-testid="feedback-seats-input"]').fill("2");
		await second.locator('[data-testid="feedback-channel-email"]').check();
		await second.locator('[data-testid="feedback-password-input"]').fill("wrong");
		const [rooted] = await Promise.all([
			second.waitForNavigation(),
			second.locator('button[type="submit"]').click(),
		]);
		expect(rooted?.status()).toBe(200);
		const rootSummary = second.locator('[data-testid="feedback-summary-root"]');
		expect(await rootSummary.innerText()).toContain(
			"That password does not match the order owner."
		);
		expect(await rootSummary.evaluate((element) => element.tagName)).toBe("SPAN");
		expect(
			await occurrences(
				second,
				'form[data-testid="recipe-remote-feedback"]',
				"That password does not match the order owner."
			)
		).toBe(1);
	});

	it("completes the pending presentation on a refusal and announces no success", async () => {
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
			await hydrated(page, "recipe-remote", "remote");
			await page.locator('[data-testid="remote-recipe-title-input"]').fill("Team digest");
			await page.locator('[data-testid="remote-recipe-seats-input"]').fill("4");
			await page.locator('[data-testid="remote-recipe-password-input"]').fill("formsnap");
			await page.getByLabel("Method").selectOption("courier");
			await page.locator('[data-testid="remote-recipe-postcode-input"]').fill("9021");

			await page.locator('button[type="submit"]').click();
			// The presentation of a submission in flight is finished by the refusal, not abandoned.
			await page.locator('[data-testid="remote-recipe-pending"]').waitFor();
			resume();
			await expect
				.poll(() => page.locator('[data-testid="remote-recipe-refusal"]').innerText(), {
					timeout: 10000,
				})
				.toContain("does not deliver to the 9xxx postcode area");
			expect(await page.locator('[data-testid="remote-recipe-pending"]').count()).toBe(0);
			expect(
				await page
					.locator('form[data-testid="recipe-remote"] button[type="submit"]')
					.isDisabled()
			).toBe(false);
			// A refused domain result is not a success: no confirmation is rendered and the values stay.
			expect(await page.locator('[data-testid="remote-recipe-message"]').count()).toBe(0);
			expect(
				await page.locator('[data-testid="remote-recipe-postcode-input"]').inputValue()
			).toBe("9021");
			expect(
				await page.locator('[data-testid="remote-recipe-password-input"]').inputValue()
			).toBe("formsnap");
		} finally {
			resume();
		}
	});

	it("keeps a rejection addressed to a form that is off screen and restores its target", async () => {
		// The page reads its instance's aggregate only while that line is rendered, so a rejection that
		// arrives while the line is off screen is unread until the line comes back. Kit reports that in
		// development; the warning is the honest record of the window, and the re-render below reads it.
		expectedDiagnostics.push(/remote_form_issues_ignored/);
		const page = await openPage();
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route("**/_app/remote/**", async (route) => {
			if (route.request().method() !== "POST") return route.continue();
			await gate;
			await route.continue();
		});
		try {
			await hydrated(page, "order-line-line_a", "remote-instances");
			await page.locator('[data-testid="order-line_a-notes-input"]').fill("mine");
			// line_c allows one, so two is the record's rejection.
			await page.locator('[data-testid="order-line_c-quantity-input"]').fill("2");
			await page.locator('[data-testid="order-line_c-save"]').click();
			await page.locator('[data-testid="order-line_c-pending"]').waitFor();

			// Removing the line while its rejection is in flight takes its target out of the document:
			// no association may be left pointing at an element that is gone.
			await page.getByLabel("Render Paper cups").uncheck();
			await expect
				.poll(() => form(page, "order-line-line_c").count(), { timeout: 10000 })
				.toBe(0);
			const missing = await page.evaluate(() => {
				const attributes = ["aria-describedby", "aria-labelledby", "aria-errormessage"];
				const dangling: string[] = [];
				for (const element of document.querySelectorAll(
					"[for], [aria-describedby], [aria-labelledby], [aria-errormessage]"
				)) {
					const references: string[] = [];
					const forAttribute = element.getAttribute("for");
					if (forAttribute) references.push(...forAttribute.split(/\s+/));
					for (const attribute of attributes) {
						const value = element.getAttribute(attribute);
						if (value) references.push(...value.split(/\s+/));
					}
					for (const id of references) {
						if (id && !document.getElementById(id))
							dangling.push(`${element.tagName}->${id}`);
					}
				}
				return dangling;
			});
			expect(missing).toEqual([]);

			release();
			// The instance kept the rejection, and rendering it again restores the control, its inline
			// container and the aggregate the page shows.
			await page.getByLabel("Render Paper cups").check();
			await expect
				.poll(
					() => page.locator('[data-testid="order-line_c-outcome"] li').allTextContents(),
					{
						timeout: 10000,
					}
				)
				.toContain("Only 1 of this line are left.");
			expect(
				await page.locator('[data-testid="order-line_c-quantity-input"]').inputValue()
			).toBe("2");
			const container = await errorContainerId(page, "order-line_c-quantity-input");
			expect(container, "the restored control references an error container").not.toBeNull();
			expect(await page.locator(`[id="${container}"]`).innerText()).toContain(
				"Only 1 of this line are left."
			);
			// The sibling that stayed on screen is unchanged.
			expect(
				await page.locator('[data-testid="order-line_a-notes-input"]').inputValue()
			).toBe("mine");
			expect(await page.locator('[data-testid="order-line_a-outcome"] li').count()).toBe(0);
		} finally {
			release();
		}
	});
});
