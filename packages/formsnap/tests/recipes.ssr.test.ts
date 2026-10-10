import { Buffer } from "node:buffer";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
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
	// A rejected action intentionally returns HTTP 400. Chromium reports that network status on its
	// console; every application warning, error and uncaught exception remains a failure.
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

const recipes = ["upload", "constraints", "composition", "feedback"] as const;
type Recipe = (typeof recipes)[number];

const recipeUrl = (path: Recipe | "") => new URL(`recipes/${path}`, fixtureUrl()).href;
const form = (page: Page, path: Recipe) => page.locator(`form[data-testid="recipe-${path}"]`);

/** Open a recipe and wait until the browser has hydrated it. */
async function hydrated(page: Page, path: Recipe) {
	await page.goto(recipeUrl(path));
	await form(page, path).and(page.locator('[data-hydrated="true"]')).waitFor();
}

describe("documented integration recipes", () => {
	it.each(recipes)("opens /recipes/%s from the index without JavaScript", async (path) => {
		const page = await openPage(false);
		await page.goto(recipeUrl(""));
		expect(await page.locator(`a[href="/recipes/${path}"]`).count()).toBe(1);
		await Promise.all([
			page.waitForNavigation(),
			page.locator(`a[href="/recipes/${path}"]`).click(),
		]);
		expect(page.url()).toBe(recipeUrl(path));
		expect(await form(page, path).count()).toBe(1);
	});

	it("renders labels, associations and unique ids in server HTML for every recipe", async () => {
		const page = await openPage(false);
		for (const path of recipes) {
			const response = await page.goto(recipeUrl(path));
			expect(response?.status()).toBe(200);
			const document = parseDocument(await page.content());
			expect(document.querySelector(`form[data-testid="recipe-${path}"]`)).not.toBeNull();
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
				expect(document.querySelector(`label[for="${id}"]`)).not.toBeNull();
			}
		}
	});

	it.each(["upload", "constraints", "feedback"] as const)(
		"keeps ids, ARIA attributes and DOM nodes across hydration at /recipes/%s",
		async (path) => {
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
				const response = await page.goto(recipeUrl(path), { waitUntil: "commit" });
				expect(response?.status()).toBe(200);
				await form(page, path).and(page.locator('[data-hydrated="false"]')).waitFor();
				const capture = () =>
					form(page, path)
						.locator("[id]")
						.evaluateAll((elements) =>
							elements.map((element) => ({
								tag: element.tagName,
								id: element.id,
								describedBy: element.getAttribute("aria-describedby"),
								invalid: element.getAttribute("aria-invalid"),
								required: element.getAttribute("aria-required"),
							}))
						);
				const before = await capture();
				await form(page, path)
					.locator("[id]")
					.evaluateAll((elements) => {
						(window as Window & { ssrNodes?: Element[] }).ssrNodes = elements;
					});
				releaseScripts();
				await form(page, path).and(page.locator('[data-hydrated="true"]')).waitFor();
				expect(await capture()).toEqual(before);
				expect(
					await form(page, path)
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

	it("renders the native constraints and the schema-derived required state", async () => {
		const page = await openPage(false);
		await page.goto(recipeUrl("constraints"));
		const document = parseDocument(await page.content());
		const handle = document.querySelector('input[name="handle"]');
		expect(handle?.hasAttribute("required")).toBe(true);
		expect(handle?.getAttribute("minlength")).toBe("3");
		expect(handle?.getAttribute("maxlength")).toBe("12");
		expect(handle?.getAttribute("pattern")).toBe("[a-z0-9_]+");
		expect(handle?.getAttribute("aria-required")).toBe("true");
		const invite = document.querySelector('input[name="invite"]');
		expect(invite?.hasAttribute("required")).toBe(true);
		expect(invite?.hasAttribute("data-no-custom-validity")).toBe(true);
	});

	it("blocks an invalid handle in the browser and reports server errors natively", async () => {
		const page = await openPage();
		const url = recipeUrl("constraints");
		await hydrated(page, "constraints");
		const handle = page.locator('input[name="handle"]');
		const invite = page.locator('input[name="invite"]');

		let posted = 0;
		page.on("request", (request) => {
			if (request.method() === "POST") posted += 1;
		});

		// A pattern mismatch never reaches the network: the browser refuses to submit the form, so
		// the schema's copy of the same rule is not the only thing standing in the way.
		await invite.fill("INV-123");
		await handle.fill("ABC");
		await page.getByRole("button", { name: "Save handle" }).click();
		expect(
			await handle.evaluate((element: HTMLInputElement) => element.validity.patternMismatch)
		).toBe(true);
		expect(posted).toBe(0);

		// A value the browser accepts, but the server rejects, reaches the action. With
		// `customValidity`, the server error becomes the input's native validity message.
		await handle.fill("admin");
		await invite.fill("wrong");
		const [response] = await Promise.all([
			page.waitForResponse(
				(candidate) => candidate.url() === url && candidate.request().method() === "POST"
			),
			page.getByRole("button", { name: "Save handle" }).click(),
		]);
		expect(response.status()).toBe(200);
		expect(await response.json()).toMatchObject({ type: "failure", status: 400 });
		await expect
			.poll(() => handle.evaluate((element: HTMLInputElement) => element.validationMessage), {
				timeout: 10000,
			})
			.toBe("This handle is reserved.");
		expect(
			await invite.evaluate((element: HTMLInputElement) => element.validationMessage)
		).toBe("");
		expect(await invite.getAttribute("aria-invalid")).toBe("true");
		expect(
			(
				await form(page, "constraints").locator("[data-fs-field-errors]").allTextContents()
			).join(" ")
		).toContain("Enter an invite code such as INV-123.");

		await handle.fill("grace");
		await invite.fill("INV-123");
		const [corrected] = await Promise.all([
			page.waitForResponse(
				(candidate) => candidate.url() === url && candidate.request().method() === "POST"
			),
			page.getByRole("button", { name: "Save handle" }).click(),
		]);
		expect(await corrected.json()).toMatchObject({ type: "success", status: 200 });
		await page.getByTestId("constraints-message").waitFor();
		expect(await page.getByTestId("constraints-message").innerText()).toBe(
			"Saved the handle grace."
		);
		expect(
			await handle.evaluate((element: HTMLInputElement) => element.validationMessage)
		).toBe("");
		expect(await form(page, "constraints").locator("[aria-invalid]").count()).toBe(0);
		expect(
			(
				await form(page, "constraints").locator("[data-fs-field-errors]").allTextContents()
			).join("")
		).toBe("");
	});

	it("submits a file input without JavaScript and reports the parsed File", async () => {
		const page = await openPage(false);
		await page.goto(recipeUrl("upload"));
		await page.getByLabel("Title", { exact: true }).fill("Holiday notes");

		const [rejected] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Upload" }).click(),
		]);
		expect(rejected?.status()).toBe(400);
		expect(
			(await form(page, "upload").locator("[data-fs-field-errors]").allTextContents()).join(
				" "
			)
		).toContain("Choose a file.");

		await page.locator('input[name="attachment"]').setInputFiles({
			name: "notes.txt",
			mimeType: "text/plain",
			buffer: Buffer.from("hello"),
		});
		const [accepted] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Upload" }).click(),
		]);
		expect(accepted?.status()).toBe(200);
		expect(accepted?.request().headers()["content-type"]).toContain("multipart/form-data");
		// The action can only report the name and the byte count if it parsed a real File, and the
		// browser never buffers a document POST body for the test to read back.
		await page.locator('[data-testid="upload-message"]').waitFor();
		expect(await page.getByTestId("upload-message").innerText()).toBe(
			"Received notes.txt (5 bytes)."
		);
	});

	it.each([false, true])(
		"rejects files over 64 kB and accepts the inclusive limit (JavaScript: %s)",
		async (javaScriptEnabled) => {
			const page = await openPage(javaScriptEnabled);
			const url = recipeUrl("upload");
			if (javaScriptEnabled) await hydrated(page, "upload");
			else await page.goto(url);
			await page.getByLabel("Title", { exact: true }).fill("Boundary");
			await page.locator('input[name="attachment"]').setInputFiles({
				name: "large.txt",
				mimeType: "text/plain",
				buffer: Buffer.alloc(64_001, "x"),
			});
			const [rejected] = await Promise.all([
				javaScriptEnabled
					? page.waitForResponse(
							(candidate) =>
								candidate.url() === url && candidate.request().method() === "POST"
						)
					: page.waitForNavigation(),
				page.getByRole("button", { name: "Upload" }).click(),
			]);
			expect(rejected?.status()).toBe(javaScriptEnabled ? 200 : 400);
			if (javaScriptEnabled)
				expect(await rejected?.json()).toMatchObject({ type: "failure", status: 400 });
			await expect
				.poll(
					async () =>
						(
							await form(page, "upload")
								.locator("[data-fs-field-errors]")
								.allTextContents()
						).join(""),
					{ timeout: 10000 }
				)
				.toContain("Keep the file at or under 64 kB.");
			expect(await page.getByLabel("Title", { exact: true }).inputValue()).toBe("Boundary");

			await page.locator('input[name="attachment"]').setInputFiles({
				name: "limit.txt",
				mimeType: "text/plain",
				buffer: Buffer.alloc(64_000, "x"),
			});
			const [accepted] = await Promise.all([
				javaScriptEnabled
					? page.waitForResponse(
							(candidate) =>
								candidate.url() === url && candidate.request().method() === "POST"
						)
					: page.waitForNavigation(),
				page.getByRole("button", { name: "Upload" }).click(),
			]);
			expect(accepted?.status()).toBe(200);
			await page.getByTestId("upload-message").waitFor();
			expect(await page.getByTestId("upload-message").innerText()).toBe(
				"Received limit.txt (64000 bytes)."
			);
			expect(await form(page, "upload").locator("[aria-invalid]").count()).toBe(0);
		}
	);

	it("enhances the same upload through Superforms without a navigation", async () => {
		const page = await openPage();
		const url = recipeUrl("upload");
		await hydrated(page, "upload");
		const titleNode = await page.getByLabel("Title", { exact: true }).elementHandle();
		await page.getByLabel("Title", { exact: true }).fill("Enhanced");
		await page.locator('input[name="attachment"]').setInputFiles({
			name: "notes.txt",
			mimeType: "text/plain",
			buffer: Buffer.from("hello"),
		});
		const [response] = await Promise.all([
			page.waitForResponse(
				(candidate) => candidate.url() === url && candidate.request().method() === "POST"
			),
			page.getByRole("button", { name: "Upload" }).click(),
		]);
		expect(response.status()).toBe(200);
		// A success means the schema accepted the submission, which requires a non-empty File.
		expect(await response.json()).toMatchObject({ type: "success", status: 200 });
		expect(response.request().headers()["x-sveltekit-action"]).toBe("true");
		expect(response.request().isNavigationRequest()).toBe(false);
		// The action can only name the file and its size if Superforms parsed a real File out of the
		// enhanced submission.
		await page.locator('[data-testid="upload-message"]').waitFor();
		expect(await page.getByTestId("upload-message").innerText()).toBe(
			"Received notes.txt (5 bytes)."
		);
		expect(
			await page
				.getByLabel("Title", { exact: true })
				.evaluate((element, original) => element === original, titleNode)
		).toBe(true);
		await titleNode?.dispose();
	});

	it("owns SSR associations for a headless control and registers free regions on mount", async () => {
		// Server-rendered: the owned slot declares its target, the freely composed region cannot.
		const server = await openPage(false);
		await server.goto(recipeUrl("composition"));
		const serverDocument = parseDocument(await server.content());
		const ratingDescriptionId = serverDocument
			.querySelector('input[name="rating"]')
			?.getAttribute("aria-describedby");
		expect(ratingDescriptionId).toBeTruthy();
		expect(
			serverDocument.getElementById(ratingDescriptionId!)?.hasAttribute("data-fs-description")
		).toBe(true);
		expect(
			serverDocument.querySelector('input[name="nickname"]')?.getAttribute("aria-describedby")
		).toBeNull();
		await context?.close();
		context = undefined;

		const page = await openPage();
		await hydrated(page, "composition");
		const refs = page.getByTestId("composition-refs");
		await expect
			.poll(() => refs.getAttribute("data-description"), { timeout: 10000 })
			.toBe("SMALL");
		// `bind:ref` hands the consumer the element the component would otherwise have rendered.
		expect(await refs.getAttribute("data-label")).toBe("LABEL");
		expect(await refs.getAttribute("data-description")).toBe("SMALL");
		expect(await refs.getAttribute("data-rating")).toBe("INPUT");

		// The custom label targets the input, and the standalone description registers on mount.
		expect(await page.locator('label[data-custom="label"]').getAttribute("for")).toBe(
			await page.locator('input[name="nickname"]').getAttribute("id")
		);
		const descriptionId = await page.locator('[data-custom="description"]').getAttribute("id");
		await expect
			.poll(() => page.locator('input[name="nickname"]').getAttribute("aria-describedby"), {
				timeout: 10000,
			})
			.toBe(descriptionId);

		// The widget built on the hooks applies the control props and keeps the range value.
		const headless = page.locator('input[name="rating"]');
		expect(await headless.getAttribute("type")).toBe("range");
		expect(await headless.getAttribute("data-fs-control")).toBe("");
		expect(await headless.inputValue()).toBe("4");

		// Custom error markup replaces the default content and keeps the error attributes.
		await page.locator('input[name="nickname"]').fill("A");
		await page.getByRole("button", { name: "Save profile" }).click();
		await page.locator('[data-custom="errors"] li').waitFor();
		expect(await page.locator('[data-custom="errors"] li').innerText()).toBe(
			"Use at least two characters."
		);
		expect(
			await page.locator('[data-custom="errors"] li').getAttribute("data-fs-field-error")
		).not.toBeNull();
		expect(await page.locator('input[name="nickname"]').getAttribute("aria-invalid")).toBe(
			"true"
		);
	});

	it.each(["composition", "feedback"] as const)(
		"renders rejected and corrected native submissions at /recipes/%s",
		async (path) => {
			const page = await openPage(false);
			await page.goto(recipeUrl(path));
			const label = path === "composition" ? "Nickname" : "Answer";
			const button = path === "composition" ? "Save profile" : "Send answer";
			const value = path === "composition" ? "Ada" : "Forty-two";
			if (path === "composition") {
				await page.getByLabel(label, { exact: true }).fill("A");
				await page.getByLabel("Rating", { exact: true }).press("Home");
				await page.getByLabel("Rating", { exact: true }).press("ArrowRight");
			}
			const [rejected] = await Promise.all([
				page.waitForNavigation(),
				page.getByRole("button", { name: button }).click(),
			]);
			expect(rejected?.status()).toBe(400);
			expect(await page.getByLabel(label, { exact: true }).getAttribute("aria-invalid")).toBe(
				"true"
			);
			expect(
				(await form(page, path).locator("[data-fs-field-errors]").allTextContents()).join(
					""
				)
			).toContain(
				path === "composition" ? "Use at least two characters." : "Enter an answer."
			);

			await page.getByLabel(label, { exact: true }).fill(value);
			const [accepted] = await Promise.all([
				page.waitForNavigation(),
				page.getByRole("button", { name: button }).click(),
			]);
			expect(accepted?.status()).toBe(200);
			expect(await page.getByTestId(`${path}-message`).innerText()).toBe(
				path === "composition" ? "Thanks, Ada." : "Answer received."
			);
			expect(await page.getByLabel(label, { exact: true }).inputValue()).toBe(value);
			expect(await form(page, path).locator("[aria-invalid]").count()).toBe(0);
			if (path === "composition")
				expect(await page.getByLabel("Rating", { exact: true }).inputValue()).toBe("2");
		}
	);

	it("shows the Superforms pending state and the action's message", async () => {
		const page = await openPage();
		const url = recipeUrl("feedback");
		let resume!: () => void;
		const gate = new Promise<void>((resolve) => {
			resume = resolve;
		});
		await page.route(url, async (route) => {
			if (route.request().method() !== "POST") return route.continue();
			await gate;
			await route.continue();
		});
		try {
			await hydrated(page, "feedback");
			await page.getByLabel("Answer", { exact: true }).fill("Forty-two");
			await page.getByRole("button", { name: "Send answer" }).click();
			// Hold the request so the pending state can be observed without racing the response.
			await page.locator('[data-testid="feedback-pending"]').waitFor();
			expect(await form(page, "feedback").locator('button[type="submit"]').isDisabled()).toBe(
				true
			);
			resume();
			await page.locator('[data-testid="feedback-message"]').waitFor();
			expect(await page.getByTestId("feedback-message").innerText()).toBe("Answer received.");
			expect(await page.locator('[data-testid="feedback-pending"]').count()).toBe(0);
		} finally {
			resume();
		}
	});
});
