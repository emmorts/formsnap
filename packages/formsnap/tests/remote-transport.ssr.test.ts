import { Buffer } from "node:buffer";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { fixtureUrl } from "./fixture-url.js";
import { isRemoteEndpointRequest } from "./remote-endpoint.js";
import { danglingReferences, duplicateIds, parseDocument } from "./html.js";

/**
 * Isolated consumer coverage for the transport fixture at /recipes/remote-transport. Every assertion
 * is about what the server received or what the field state reads, never about the transport name
 * Kit builds: the buttons are asserted for shaping one field between them, and the value they carry
 * is asserted where it arrives, in the handler's own result.
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
	expect(diagnostics.filter(Boolean)).toEqual([]);
});

const url = () => new URL("recipes/remote-transport", fixtureUrl()).href;
const form = (page: Page) => page.locator('form[data-testid="recipe-remote-transport"]');
const resultNode = (page: Page) => page.locator('[data-testid="transport-result"]');
const stateNode = (page: Page, field: "seats" | "subscribe") =>
	page.locator(`[data-testid="transport-${field}-state"]`);
const seatsInput = (page: Page) => page.locator('[data-testid="transport-seats-input"]');
const subscribeInput = (page: Page) => page.locator('[data-testid="transport-subscribe-input"]');

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

/** Open the fixture and wait until the browser has hydrated the remote form. */
async function hydrated(page: Page) {
	await page.goto(url());
	await form(page).and(page.locator('[data-hydrated="true"]')).waitFor();
}

/** The values the handler reported, or undefined when no accepted result is rendered. */
async function received(page: Page) {
	const node = resultNode(page);
	if ((await node.count()) === 0) return undefined;
	return {
		decision: await node.getAttribute("data-decision"),
		seats: await node.getAttribute("data-seats"),
		subscribe: await node.getAttribute("data-subscribe"),
		channels: await node.getAttribute("data-channels"),
		attachment: await node.getAttribute("data-attachment"),
		attempts: Number(await node.getAttribute("data-attempts")),
	};
}

/** The field's own interaction state and value read, as the fixture renders them. */
async function fieldState(page: Page, field: "seats" | "subscribe") {
	const node = stateNode(page, field);
	return {
		touched: await node.getAttribute("data-touched"),
		dirty: await node.getAttribute("data-dirty"),
		value: await node.getAttribute("data-value"),
	};
}

describe("remote transport fixture", () => {
	it("names one field with both submit buttons, from Kit's own props", async () => {
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

		// Both buttons shape the one `decision` field, so the page wrote no name of its own: Kit's
		// `as("submit", ...)` supplied both the shared name and the per-button value. The test never
		// asserts the encoded name itself, only that the two buttons agree on it and differ by value.
		const buttons = await page.locator("form button[type='submit']").evaluateAll((elements) =>
			elements.map((element) => ({
				name: element.getAttribute("name"),
				value: (element as HTMLButtonElement).value,
			}))
		);
		expect(buttons).toHaveLength(2);
		const [save, publish] = buttons;
		expect(save.name).toBeTruthy();
		expect(save.name).toBe(publish.name);
		expect(save.name).not.toBe("decision");
		expect([save.value, publish.value]).toEqual(["save", "publish"]);

		// Every other transport name Kit generated carries the same form suffix, which is what lets
		// the handler parse the submitter's name into a field path at all.
		const suffix = save.name!.slice(save.name!.lastIndexOf("/"));
		for (const control of document.querySelectorAll("form [name]")) {
			expect(control.getAttribute("name"), `name of ${control.tagName}`).toContain(suffix);
		}

		// The rendered edit defaults are the page's contract with the user.
		expect(seatsInput(page)).toBeTruthy();
		expect(await stateNode(page, "seats").getAttribute("data-value")).toBe("2");
		expect(await subscribeInput(page).isChecked()).toBe(true);
	});

	it("receives the typed values and the activated submitter natively", async () => {
		const page = await openPage(false);
		await page.goto(url());
		await seatsInput(page).fill("4");
		await subscribeInput(page).uncheck();
		await page.locator('[data-testid="transport-channel-push"]').check();
		await page.locator('[data-testid="transport-attachment-input"]').setInputFiles({
			name: "order.txt",
			mimeType: "text/plain",
			buffer: Buffer.from("hello"),
		});

		const [response] = await Promise.all([
			page.waitForNavigation(),
			page.locator('[data-testid="transport-submit-publish"]').click(),
		]);
		expect(response?.status()).toBe(200);

		// A native POST carries the activated submitter's name and value like any other entry, so the
		// handler reads the button that was pressed from the payload rather than from a hidden field.
		expect(await received(page)).toMatchObject({
			decision: "publish",
			seats: "4",
			subscribe: "false",
			channels: "email, push",
			attachment: "order.txt (5 bytes)",
		});

		// One submission is one handler run. A second native submission moves the count by exactly one,
		// which is what makes the count usable as evidence that a preflight failure never got there.
		const first = (await received(page))!.attempts;
		await seatsInput(page).fill("3");
		const [second] = await Promise.all([
			page.waitForNavigation(),
			page.locator('[data-testid="transport-submit-save"]').click(),
		]);
		expect(second?.status()).toBe(200);
		const after = await received(page);
		// The accepted native response renders the page's defaults again (Kit echoes input only
		// alongside issues), so only the values this submission carried are asserted here.
		expect(after).toMatchObject({ decision: "save", seats: "3" });
		expect(after!.attempts).toBe(first + 1);
	});

	it("reports the submitter the user activated on the enhanced path", async () => {
		const page = await openPage();
		await hydrated(page);

		const [published] = await Promise.all([
			page.waitForResponse(isRemoteEndpointRequest),
			page.locator('[data-testid="transport-submit-publish"]').click(),
		]);
		expect(published.status()).toBe(200);
		expect(await received(page)).toMatchObject({ decision: "publish", seats: "2" });

		// The other button names the same field, so the submission in flight replaced the value the
		// first button put there rather than carrying both.
		const [saved] = await Promise.all([
			page.waitForResponse(isRemoteEndpointRequest),
			page.locator('[data-testid="transport-submit-save"]').click(),
		]);
		expect(saved.status()).toBe(200);
		const result = await received(page);
		expect(result).toMatchObject({ decision: "save" });
		expect(result!.attempts).toBeGreaterThan(0);
	});

	it("keeps input the client pass rejects away from the handler", async () => {
		const page = await openPage();
		let posted = 0;
		page.on("request", (request) => {
			if (request.method() === "POST") posted += 1;
		});
		await hydrated(page);

		// One accepted submission first, so the count has a value to compare against.
		await seatsInput(page).fill("3");
		const [accepted] = await Promise.all([
			page.waitForResponse(isRemoteEndpointRequest),
			page.locator('[data-testid="transport-submit-save"]').click(),
		]);
		expect(accepted.status()).toBe(200);
		const before = (await received(page))!.attempts;

		// The client pass rejects a seat count below one. No request leaves the browser, so nothing can
		// have reached the handler, and the feedback still renders.
		await seatsInput(page).fill("0");
		await page.locator('[data-testid="transport-submit-save"]').click();
		expect(posted).toBe(1);
		await expect
			.poll(() => form(page).locator("[data-fs-field-error]").allTextContents(), {
				timeout: 10000,
			})
			.toContain("Book at least one seat.");

		// The server's own count is the evidence: the next accepted submission is exactly one run after
		// the previous one, so the rejected submission never ran the handler.
		await seatsInput(page).fill("3");
		const [next] = await Promise.all([
			page.waitForResponse(isRemoteEndpointRequest),
			page.locator('[data-testid="transport-submit-save"]').click(),
		]);
		expect(next.status()).toBe(200);
		expect((await received(page))!.attempts).toBe(before + 1);
	});

	it("keeps the group rule and the file limit on the server", async () => {
		const page = await openPage();
		await hydrated(page);

		// The client pass deliberately does not check the group, so this submission reaches the server,
		// which reports the group's own rule as an inline issue.
		for (const channel of ["email", "push"]) {
			await page.locator(`[data-testid="transport-channel-${channel}"]`).uncheck();
		}
		const [group] = await Promise.all([
			page.waitForResponse(isRemoteEndpointRequest),
			page.locator('[data-testid="transport-submit-save"]').click(),
		]);
		expect(group.status()).toBe(200);
		expect(await form(page).locator("[data-fs-field-error]").allTextContents()).toContain(
			"Choose at least one channel."
		);
		expect(await received(page)).toBeUndefined();
		expect(await seatsInput(page).inputValue()).toBe("2");

		// The same for the file: the picker let the file through, and the server rejects it.
		await page.locator('[data-testid="transport-channel-email"]').check();
		await page.locator('[data-testid="transport-attachment-input"]').setInputFiles({
			name: "large.txt",
			mimeType: "text/plain",
			buffer: Buffer.alloc(64_001, "x"),
		});
		const [file] = await Promise.all([
			page.waitForResponse(isRemoteEndpointRequest),
			page.locator('[data-testid="transport-submit-save"]').click(),
		]);
		expect(file.status()).toBe(200);
		expect(await form(page).locator("[data-fs-field-error]").allTextContents()).toContain(
			"Keep the file at or under 64 kB."
		);

		// The inclusive limit is accepted, and the handler reports the file it parsed.
		await page.locator('[data-testid="transport-attachment-input"]').setInputFiles({
			name: "limit.txt",
			mimeType: "text/plain",
			buffer: Buffer.alloc(64_000, "x"),
		});
		const [accepted] = await Promise.all([
			page.waitForResponse(isRemoteEndpointRequest),
			page.locator('[data-testid="transport-submit-save"]').click(),
		]);
		expect(accepted.status()).toBe(200);
		expect(await received(page)).toMatchObject({ attachment: "limit.txt (64000 bytes)" });
	});

	it("restores the rendered defaults and clears the interaction state on reset", async () => {
		const page = await openPage();
		await hydrated(page);

		await seatsInput(page).fill("5");
		await subscribeInput(page).uncheck();
		await expect
			.poll(() => fieldState(page, "seats"), { timeout: 10000 })
			.toMatchObject({
				touched: "true",
				dirty: "true",
				value: "5",
			});
		await expect.poll(() => subscribeInput(page).isChecked(), { timeout: 10000 }).toBe(false);

		await page.locator('[data-testid="transport-reset"]').click();

		// The controls are back on the defaults the page rendered, including the ones the user did not
		// touch, and the field the page writes back reads the same value as the control.
		await expect.poll(() => seatsInput(page).inputValue(), { timeout: 10000 }).toBe("2");
		await expect
			.poll(() => fieldState(page, "seats").then((state) => state.value), { timeout: 10000 })
			.toBe("2");
		expect(await subscribeInput(page).isChecked()).toBe(true);
		expect(await page.locator('[data-testid="transport-channel-email"]').isChecked()).toBe(
			true
		);
		expect(await page.locator('[data-testid="transport-channel-sms"]').isChecked()).toBe(false);
		expect(await page.locator('[data-testid="transport-channel-push"]').isChecked()).toBe(true);

		// Kit clears the touched and dirty state it tracks on the form's reset event. The fixture writes
		// only the seats field back, so a field it does not write keeps Kit's own cleared state and the
		// interaction the user performed is no longer reported.
		await expect
			.poll(() => fieldState(page, "subscribe"), { timeout: 10000 })
			.toMatchObject({
				touched: "false",
				dirty: "false",
			});
		// Kit's `set` counts a programmatic write as an edit, so the field the page writes back reports
		// the reset itself as an edit. That is the documented policy's own cost, not a stale read: the
		// value read above agrees with the control.
		expect(await fieldState(page, "seats")).toMatchObject({ dirty: "true" });
	});
});
