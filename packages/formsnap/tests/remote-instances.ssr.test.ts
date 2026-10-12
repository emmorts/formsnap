import { Buffer } from "node:buffer";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { fixtureUrl } from "./fixture-url.js";
import { isRemoteEndpointRequest } from "./remote-endpoint.js";
import { danglingReferences, duplicateIds, parseDocument } from "./html.js";

/**
 * Route-level coverage for the instance recipe at /recipes/remote-instances. Native submissions are
 * real page POSTs, the enhanced ones run in a hydrated page, and one case forges the instance key in
 * the action URL, which is the only way a client can change it.
 */

let browser: Browser;
let context: BrowserContext | undefined;
let diagnostics: string[];
/** Resource failures and library errors a test expects, such as the multiple-attachment mistake. */
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
	// Every other browser warning, error and uncaught exception is a failure.
	expect(
		diagnostics.filter((text) => !expectedDiagnostics.some((allowed) => allowed.test(text)))
	).toEqual([]);
});

const url = () => new URL("recipes/remote-instances", fixtureUrl()).href;
/** The page names every control `<order>-<key>-<part>` and the form itself `order-line-<key>`. */
const line = (key: string) => `order-${key}`;
const form = (page: Page, key: string) => page.locator(`form[data-testid="order-line-${key}"]`);
const outcomeIssues = (page: Page, key: string) =>
	page.locator(`[data-testid="${line(key)}-outcome"] li`);

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

async function openLines(javaScriptEnabled = true) {
	const page = await openPage(javaScriptEnabled);
	await page.goto(url());
	if (javaScriptEnabled) {
		await form(page, "line_a").and(page.locator('[data-hydrated="true"]')).waitFor();
	}
	return page;
}

/** Submits natively and returns the response, so a test can assert on the rendered page. */
async function submitNatively(page: Page, key: string) {
	const [response] = await Promise.all([
		page.waitForNavigation(),
		page.getByTestId(`${line(key)}-save`).click(),
	]);
	return response;
}

/** A dangling id reference in the live document, which is what a stale summary link would be. */
async function danglingInPage(page: Page) {
	return page.evaluate(() => {
		const attributes = ["aria-describedby", "aria-labelledby", "aria-errormessage"];
		const missing: string[] = [];
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
				if (id && !document.getElementById(id)) missing.push(`${element.tagName}->${id}`);
			}
		}
		return missing;
	});
}

describe("remote instance recipe", () => {
	it("renders one keyed instance per line with unique identities and no JavaScript", async () => {
		const page = await openLines(false);
		const response = await page.goto(url());
		expect(response?.status()).toBe(200);

		const document = parseDocument(await page.content());
		expect(duplicateIds(document)).toEqual([]);
		expect(danglingReferences(document)).toEqual([]);

		// Each instance posts to its own keyed action, while the transport names inside them repeat:
		// the key is what tells the instances apart, not the field names.
		const actions = [...document.querySelectorAll("form[data-testid]")].map((element) =>
			element.getAttribute("action")
		);
		expect(actions).toHaveLength(3);
		expect(new Set(actions).size).toBe(3);
		expect(
			new Set(
				[...document.querySelectorAll('input[data-testid$="-label-input"]')].map((input) =>
					input.getAttribute("name")
				)
			).size
		).toBe(1);

		// A file control needs the multipart enctype on the element that submits it natively.
		for (const element of document.querySelectorAll("form[data-testid]")) {
			expect(element.getAttribute("enctype")).toBe("multipart/form-data");
		}

		// Every control is labelled, and each form confirms it is in the document once.
		for (const key of ["line_a", "line_b", "line_c"]) {
			expect(await form(page, key).count()).toBe(1);
		}
		// The custom control is enhancement-only and says so.
		const stepper = page.getByTestId("order-line_a-quantity-stepper");
		expect(await stepper.getAttribute("data-enhancement-only")).toBe("");
		expect(await page.getByTestId("order-line_a-quantity-more").isDisabled()).toBe(true);
		// The native control it drives does not depend on it.
		expect(await page.getByTestId("order-line_a-quantity-input").isDisabled()).toBe(false);
	});

	it("submits a native multipart line and cannot restore the uploaded file", async () => {
		const page = await openLines(false);
		await page.getByTestId("order-line_b-notes-input").fill("twelve units");
		await page.getByTestId("order-line_b-attachment-input").setInputFiles({
			name: "order.txt",
			mimeType: "text/plain",
			buffer: Buffer.from("hello"),
		});

		const response = await submitNatively(page, "line_b");
		expect(response?.status()).toBe(200);
		const message = await page.getByTestId("order-line_b-message").innerText();
		expect(message).toContain("Saved 1 of Oat milk on line_b");
		expect(message).toContain("order.txt (5 bytes)");

		// A file input is the user's to fill: nothing can put the file back, and the values the form
		// does carry are not a claim about the file.
		expect(
			await page.getByTestId("order-line_b-attachment-input").evaluate((element) => {
				const input = element as HTMLInputElement;
				return input.files?.length ?? 0;
			})
		).toBe(0);
		expect(await outcomeIssues(page, "line_b").count()).toBe(0);
	});

	it("enforces the file limit on the server rather than in the picker", async () => {
		const page = await openLines(false);
		await page.getByTestId("order-line_c-attachment-input").setInputFiles({
			name: "large.txt",
			mimeType: "text/plain",
			buffer: Buffer.alloc(64_001, "x"),
		});
		const rejected = await submitNatively(page, "line_c");
		expect(rejected?.status()).toBe(200);
		expect(await outcomeIssues(page, "line_c").allTextContents()).toContain(
			"Keep the file at or under 64 kB."
		);

		// No `accept` or size hint is what enforces this: the same control with a smaller file passes.
		await page.getByTestId("order-line_c-attachment-input").setInputFiles({
			name: "limit.txt",
			mimeType: "text/plain",
			buffer: Buffer.alloc(64_000, "x"),
		});
		const accepted = await submitNatively(page, "line_c");
		expect(accepted?.status()).toBe(200);
		expect(await page.getByTestId("order-line_c-message").innerText()).toContain(
			"limit.txt (64000 bytes)"
		);
		expect(await outcomeIssues(page, "line_c").count()).toBe(0);
	});

	it("keeps one instance's rejection on the instance that submitted", async () => {
		const page = await openLines(false);
		await page.getByTestId("order-line_c-quantity-input").fill("2");

		const response = await submitNatively(page, "line_c");
		expect(response?.status()).toBe(200);

		// The record's rule is the rejection, and it is reported on the instance that submitted.
		expect(await outcomeIssues(page, "line_c").allTextContents()).toContain(
			"Only 1 of this line are left."
		);
		expect(await page.getByTestId("order-line_c-quantity-input").getAttribute("value")).toBe(
			"2"
		);
		// No sibling shows any part of that rejection. Their values are not in a native submission at
		// all, because it reloads the whole page; the enhanced test below proves sibling isolation
		// where the document is never replaced.
		expect(await outcomeIssues(page, "line_a").count()).toBe(0);
		expect(await outcomeIssues(page, "line_b").count()).toBe(0);
		expect(await page.getByTestId("order-line_a-message").count()).toBe(0);
		expect(await page.getByTestId("order-line_c-message").count()).toBe(0);
	});

	it("refuses a key the server does not own, because a key is input rather than permission", async () => {
		const page = await openLines(false);
		const action = await form(page, "line_b").getAttribute("action");
		const fields: Record<string, string> = {};
		for (const [part, value] of [
			["label", "Oat milk"],
			["quantity", "1"],
			["notes", ""],
		]) {
			const name = await page.getByTestId(`order-line_b-${part}-input`).getAttribute("name");
			if (!name) throw new Error(`the line renders no ${part} field name`);
			fields[name] = value;
		}
		if (!action) throw new Error("the line form renders no action");

		// The same request for the line the form belongs to is accepted, so the refusal below is the
		// record's decision about the key rather than a broken request.
		const accepted = await context!.request.post(new URL(action, url()).href, {
			headers: { accept: "text/html" },
			form: fields,
		});
		expect(accepted.status()).toBe(200);
		expect(await accepted.text()).not.toContain("That order line is not on this order.");

		// A key the server does not own is refused. The page renders only the lines it owns, so there
		// is no control for this issue to attach to: the payload for that instance carries it, and no
		// line is accepted.
		const forgedAction = new URL(action, url());
		const instanceParameter = [...forgedAction.searchParams.entries()].find(([, value]) =>
			value.endsWith(`/${JSON.stringify("line_b")}`)
		);
		if (!instanceParameter) throw new Error("the line action renders no instance parameter");
		const [parameter, remotePath] = instanceParameter;
		const endpoint = remotePath.slice(0, remotePath.lastIndexOf("/") + 1);
		// Inherited object names must be refused too, not mistaken for owned order records.
		for (const key of ["line_z", "constructor", "toString", "__proto__"]) {
			forgedAction.searchParams.set(parameter, `${endpoint}${JSON.stringify(key)}`);
			const refused = await context!.request.post(forgedAction.href, {
				headers: { accept: "text/html" },
				form: fields,
			});
			expect(refused.status()).toBe(200);
			const refusedBody = await refused.text();
			expect(refusedBody, `unowned key ${key}`).toContain(
				"That order line is not on this order."
			);
			expect(refusedBody, `unowned key ${key}`).not.toContain("Saved 1 of Oat milk");
		}
	});

	it("changes the field state and the submitted data together through the custom control", async () => {
		const page = await openLines();
		// One write to the field: the state changes, the native control renders it, and the readout
		// the widget shows comes from the same state.
		await page.getByTestId("order-line_a-quantity-more").click();
		await expect
			.poll(() => page.getByTestId("order-line_a-quantity-input").inputValue(), {
				timeout: 10000,
			})
			.toBe("3");
		await expect
			.poll(() => page.getByTestId("order-line_a-quantity-readout").innerText(), {
				timeout: 10000,
			})
			.toBe("3");

		const [response] = await Promise.all([
			page.waitForResponse(isRemoteEndpointRequest),
			page.getByTestId("order-line_a-save").click(),
		]);
		expect(response.status()).toBe(200);
		// The server received the value the widget produced, which is what proves the two agree.
		await expect
			.poll(() => page.getByTestId("order-line_a-message").innerText(), { timeout: 10000 })
			.toContain("Saved 3 of Espresso beans");
		// Kit's own enhancement resets an accepted submission, and the readout follows it back.
		await expect
			.poll(() => page.getByTestId("order-line_a-quantity-input").inputValue(), {
				timeout: 10000,
			})
			.toBe("2");
		await expect
			.poll(() => page.getByTestId("order-line_a-quantity-readout").innerText(), {
				timeout: 10000,
			})
			.toBe("2");
	});

	it("resets to the rendered defaults, clears the issues and keeps a sibling untouched", async () => {
		const page = await openLines();
		await page.getByTestId("order-line_a-notes-input").fill("a note");
		await page.getByTestId("order-line_c-quantity-more").click();
		// The widget writes the field state, so wait until the control that submits carries it.
		await expect
			.poll(() => page.getByTestId("order-line_c-quantity-input").inputValue(), {
				timeout: 10000,
			})
			.toBe("2");
		const [rejected] = await Promise.all([
			page.waitForResponse(isRemoteEndpointRequest),
			page.getByTestId("order-line_c-save").click(),
		]);
		expect(rejected.status()).toBe(200);
		await expect
			.poll(() => outcomeIssues(page, "line_c").allTextContents(), { timeout: 10000 })
			.toContain("Only 1 of this line are left.");
		// The rejection was applied to the instance that submitted. A sibling keeps what the user
		// typed into it, because an enhanced submission never replaces the document.
		expect(await page.getByTestId("order-line_a-notes-input").inputValue()).toBe("a note");
		expect(await outcomeIssues(page, "line_a").count()).toBe(0);

		await page.getByTestId("order-line_c-reset").click();
		// Kit's reset contract clears the issues and the interaction state it tracks, and the recipe
		// writes the rendered defaults back once the DOM has restored them, so the readout agrees.
		await expect.poll(() => outcomeIssues(page, "line_c").count(), { timeout: 10000 }).toBe(0);
		await expect
			.poll(() => page.getByTestId("order-line_c-quantity-input").inputValue(), {
				timeout: 10000,
			})
			.toBe("1");
		await expect
			.poll(() => page.getByTestId("order-line_c-quantity-readout").innerText(), {
				timeout: 10000,
			})
			.toBe("1");
		await expect
			.poll(() => page.getByTestId("order-line_c-notes-input").inputValue(), {
				timeout: 10000,
			})
			.toBe("");
		expect(await page.getByTestId("order-line_c-message").count()).toBe(0);

		// The reset belongs to one instance: the sibling keeps its typed value and its own state.
		expect(await page.getByTestId("order-line_a-notes-input").inputValue()).toBe("a note");
	});

	it("completes a submission that outlives its form without leaking it into a sibling", async () => {
		const page = await openLines();
		await page.getByTestId("order-line_a-notes-input").fill("mine");
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
			await page.getByTestId("order-line_b-notes-input").fill("late");
			await page.getByTestId("order-line_b-save").click();
			await page.getByTestId("order-line_b-pending").waitFor();
			// The form leaves the document while its submission is still in flight.
			await page.getByLabel("Render Oat milk").uncheck();
			await expect.poll(() => form(page, "line_b").count(), { timeout: 10000 }).toBe(0);
			expect(await danglingInPage(page)).toEqual([]);
			expect(await page.getByTestId("order-line_b-hidden-status").innerText()).toBe(
				"Saving…"
			);
			release();
			await expect
				.poll(() => page.getByTestId("order-line_b-hidden-status").innerText(), {
					timeout: 10000,
				})
				.toBe("Saved 1 of Oat milk on line_b.");
			expect(await form(page, "line_b").count()).toBe(0);

			// The instance kept the submission, and rendering it again shows that state.
			await page.getByLabel("Render Oat milk").check();
			await expect
				.poll(() => page.getByTestId("order-line_b-message").innerText(), {
					timeout: 10000,
				})
				.toContain("Saved 1 of Oat milk on line_b");
			expect(await page.getByTestId("order-line_b-notes-input").inputValue()).toBe("late");
			// The sibling that stayed on screen is unchanged and shows no part of that submission.
			expect(await page.getByTestId("order-line_a-notes-input").inputValue()).toBe("mine");
			expect(await page.getByTestId("order-line_a-message").count()).toBe(0);
		} finally {
			release();
		}
	});

	it("fails loudly instead of attaching one instance to two forms", async () => {
		const page = await openLines();
		expectedDiagnostics.push(/only be attached to a single/, /hmr_reload_after_error/);
		let posted = 0;
		page.on("request", (request) => {
			if (request.method() === "POST") posted += 1;
		});
		await page.locator("#instances-duplicate").click();

		// Kit refuses the second attachment itself, so the failure is visible rather than a form that
		// silently submits the same instance's data twice. The route's error boundary renders it.
		await expect
			.poll(() => page.getByTestId("instances-error").count(), { timeout: 10000 })
			.toBe(1);
		expect(diagnostics.join("\n")).toContain("remote_form_multiple_elements");
		expect(posted).toBe(0);
		await page.getByTestId("instances-error-retry").click();
		await form(page, "line_a").and(page.locator('[data-hydrated="true"]')).waitFor();
		expect(await page.getByTestId("order-line_a-quantity-more").isDisabled()).toBe(false);
	});
});
