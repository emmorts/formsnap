import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
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

afterEach(async () => {
	await context?.close();
	context = undefined;
	// A rejected action intentionally returns HTTP 400. Chromium reports that network status
	// on its console; every application warning/error and uncaught exception remains a failure.
	expect(diagnostics.filter((text) => !/Failed to load resource:.*400/.test(text))).toEqual([]);
});

async function openPage(javaScriptEnabled = true) {
	diagnostics = [];
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

async function assertAssociations(page: Page) {
	const document = parseDocument(await page.content());
	expect(duplicateIds(document)).toEqual([]);
	expect(danglingReferences(document)).toEqual([]);
	for (const input of document.querySelectorAll("form input, form textarea")) {
		const id = input.getAttribute("id");
		expect(id, `id for ${input.getAttribute("name")}`).toBeTruthy();
		expect(document.querySelector(`label[for="${id}"]`)).not.toBeNull();
	}
}

async function rows(page: Page) {
	return page.locator("[data-row]").evaluateAll((elements) =>
		elements.map((element) => ({
			value: JSON.parse(element.querySelector("output")!.getAttribute("data-value")!),
			input: (element.querySelector("input") as HTMLInputElement).value,
			name: (element.querySelector("input") as HTMLInputElement).name,
		}))
	);
}

describe("real SvelteKit consumers", () => {
	it("hydrates the very same SSR document without changing ids or replacing controls", async () => {
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
			const response = await page.goto(fixtureUrl(), { waitUntil: "commit" });
			expect(response?.status()).toBe(200);
			await page.locator('form[data-hydrated="false"]').waitFor();
			const before = await page.locator("form [id]").evaluateAll((elements) => {
				(window as Window & { ssrNodes?: Element[] }).ssrNodes = elements;
				return elements.map((element) => ({ tag: element.tagName, id: element.id }));
			});
			expect(before.length).toBeGreaterThan(2);
			expect(await page.locator('[name="email"]').getAttribute("id")).toBe("email-input");
			expect(await page.locator('[name="bio"]').getAttribute("id")).toBeTruthy();
			await assertAssociations(page);

			releaseScripts();
			await page.locator('form[data-hydrated="true"]').waitFor();
			const after = await page.locator("form [id]").evaluateAll((elements) => ({
				ids: elements.map((element) => ({ tag: element.tagName, id: element.id })),
				reused: elements.every(
					(element, index) =>
						element === (window as Window & { ssrNodes?: Element[] }).ssrNodes?.[index]
				),
			}));
			expect(after.ids).toEqual(before);
			expect(after.reused).toBe(true);
			for (const name of ["email", "bio"]) {
				expect(
					await page.locator(`[name="${name}"]`).getAttribute("aria-describedby")
				).toBeTruthy();
			}
			await assertAssociations(page);
		} finally {
			releaseScripts();
		}
	});

	it("submits and renders rejected and accepted settings with JavaScript disabled", async () => {
		const page = await openPage(false);
		await page.goto(fixtureUrl());
		await page.getByLabel("Email", { exact: true }).fill("a@example.com");
		await page.getByLabel("Bio", { exact: true }).fill("x".repeat(251));
		const [rejected] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Save settings" }).click(),
		]);
		expect(rejected?.status()).toBe(400);
		expect(await page.getByLabel("Email", { exact: true }).inputValue()).toBe("a@example.com");
		expect(await page.getByLabel("Bio", { exact: true }).inputValue()).toBe("x".repeat(251));
		expect(await page.getByLabel("Bio", { exact: true }).getAttribute("aria-invalid")).toBe(
			"true"
		);
		expect((await page.locator("[data-fs-field-errors]").allTextContents()).join("")).toContain(
			"250"
		);
		expect(await page.locator("form").getAttribute("data-hydrated")).toBe("false");
		await assertAssociations(page);

		await page.getByLabel("Bio", { exact: true }).fill("Hello");
		const [accepted] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Save settings" }).click(),
		]);
		expect(accepted?.status()).toBe(200);
		expect(new URLSearchParams(accepted!.request().postData()!).get("bio")).toBe("Hello");
		// The canonical example retains Superforms' default reset-on-success behavior.
		expect(await page.getByLabel("Bio", { exact: true }).inputValue()).toBe("");
		expect(await page.locator("[aria-invalid]").count()).toBe(0);
	});

	it("uses actual repeated-name browser POSTs for arrays without JavaScript", async () => {
		const page = await openPage(false);
		await page.goto(new URL("arrays", fixtureUrl()).href);
		const inputs = page.locator('input[name="urls"]');
		expect(await inputs.count()).toBe(2);
		await inputs.nth(0).fill("https://first.example");
		await inputs.nth(1).fill("invalid");
		const [rejected] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Save URLs" }).click(),
		]);
		expect(rejected?.status()).toBe(400);
		expect(new URLSearchParams(rejected!.request().postData()!).getAll("urls")).toEqual([
			"https://first.example",
			"invalid",
		]);
		expect(JSON.parse(await page.getByTestId("submission-data").innerText())).toEqual({
			urls: ["https://first.example", "invalid"],
		});
		expect(
			JSON.parse(await page.getByTestId("submission-errors").innerText()).urls[1]
		).toContain("Enter a valid URL.");
		expect(await inputs.nth(0).getAttribute("aria-invalid")).toBeNull();
		expect(await inputs.nth(1).getAttribute("aria-invalid")).toBe("true");
		expect(await page.locator('[data-row="1"] [data-fs-field-errors]').innerText()).toContain(
			"Enter a valid URL."
		);
		await assertAssociations(page);

		await inputs.nth(1).fill("https://second.example");
		const [accepted] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Save URLs" }).click(),
		]);
		expect(accepted?.status()).toBe(200);
		expect(JSON.parse(await page.getByTestId("submission-data").innerText())).toEqual({
			urls: ["https://first.example", "https://second.example"],
		});
		expect(await page.locator("[aria-invalid]").count()).toBe(0);
	});

	it("keeps primitive row values, labels and native names aligned after mutations", async () => {
		const page = await openPage();
		await page.goto(new URL("arrays", fixtureUrl()).href);
		await page.locator('form[data-hydrated="true"]').waitFor();
		await page.getByRole("button", { name: "Add row", exact: true }).click();
		const movedId = await page.locator('[data-row="2"] input').getAttribute("id");
		await page.getByRole("button", { name: "Reorder rows", exact: true }).click();
		await page.getByRole("button", { name: "Remove row", exact: true }).click();
		expect(await rows(page)).toEqual([
			{ value: "https://added.example", input: "https://added.example", name: "urls" },
			{ value: "https://b.example", input: "https://b.example", name: "urls" },
		]);
		expect(await page.locator('[data-row="0"] input').getAttribute("id")).toBe(movedId);
		expect(await page.locator("fieldset > legend").innerText()).toBe("Website URLs");
		expect(await page.locator("fieldset input").count()).toBe(2);
		await assertAssociations(page);
		const [accepted] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Save URLs" }).click(),
		]);
		expect(accepted?.status()).toBe(200);
		expect(JSON.parse(await page.getByTestId("submission-data").innerText())).toEqual({
			urls: ["https://added.example", "https://b.example"],
		});
	});

	it("enhances nested and object-array JSON through Superforms and renders server validation", async () => {
		const page = await openPage();
		const url = new URL("json", fixtureUrl()).href;
		await page.goto(url);
		await page.locator('form[data-hydrated="true"]').waitFor();
		await page.getByLabel("Profile name", { exact: true }).fill("x");
		const typedInputId = await page.getByLabel("Contact 2", { exact: true }).getAttribute("id");
		await page.getByLabel("Contact 2", { exact: true }).fill("");
		await page.getByLabel("Contact 2", { exact: true }).pressSequentially("broken");
		expect(await page.getByLabel("Contact 2", { exact: true }).inputValue()).toBe("broken");
		expect(await page.getByLabel("Contact 2", { exact: true }).getAttribute("id")).toBe(
			typedInputId
		);
		expect(await page.locator('[data-row="1"] output').getAttribute("data-tainted")).toBe(
			"true"
		);
		await page.getByRole("button", { name: "Add row", exact: true }).click();
		const movedId = await page.locator('[data-row="2"] input').getAttribute("id");
		await page.getByRole("button", { name: "Reorder rows", exact: true }).click();
		await page.getByRole("button", { name: "Remove row", exact: true }).click();
		expect(await page.getByTestId("profile-value").getAttribute("data-value")).toBe('"x"');
		expect(await rows(page)).toEqual([
			{ value: "added@example.com", input: "added@example.com", name: "contacts" },
			{ value: "broken", input: "broken", name: "contacts" },
		]);
		expect(await page.locator('[data-row="0"] input').getAttribute("id")).toBe(movedId);
		expect(await page.locator('[data-row="1"] output').getAttribute("data-tainted")).toBe(
			"true"
		);
		expect(await page.locator("fieldset > legend").innerText()).toBe("Contacts");
		await assertAssociations(page);
		await page.evaluate(() => {
			(window as Window & { enhancedDocument?: boolean }).enhancedDocument = true;
		});
		const [rejected] = await Promise.all([
			page.waitForResponse(
				(response) => response.url() === url && response.request().method() === "POST"
			),
			page.getByRole("button", { name: "Save contacts" }).click(),
		]);
		// Enhanced Kit actions encode the validation status inside an HTTP 200 ActionResult.
		expect(rejected.status()).toBe(200);
		expect(await rejected.json()).toMatchObject({ type: "failure", status: 400 });
		expect(rejected.request().isNavigationRequest()).toBe(false);
		expect(rejected.request().headers()["x-sveltekit-action"]).toBe("true");
		expect(rejected.request().postData()).toContain("__superform_json");
		await page.waitForFunction(
			() => document.querySelector('[data-testid="updates"]')?.textContent === "1"
		);
		expect(
			await page.evaluate(
				() => (window as Window & { enhancedDocument?: boolean }).enhancedDocument
			)
		).toBe(true);
		expect(JSON.parse(await page.getByTestId("submission-data").innerText())).toEqual({
			profile: { name: "x" },
			contacts: [{ email: "added@example.com" }, { email: "broken" }],
		});
		const errors = JSON.parse(await page.getByTestId("submission-errors").innerText());
		expect(errors.profile.name).toContain("Enter at least two characters.");
		expect(errors.contacts[1].email).toContain("Enter a valid email address.");
		expect(await page.getByTestId("submission-valid").innerText()).toBe("false");
		expect(
			await page.getByLabel("Profile name", { exact: true }).getAttribute("aria-invalid")
		).toBe("true");
		expect(
			await page.getByLabel("Contact 1", { exact: true }).getAttribute("aria-invalid")
		).toBeNull();
		expect(
			await page.getByLabel("Contact 2", { exact: true }).getAttribute("aria-invalid")
		).toBe("true");
		expect(await page.locator('[data-row="1"] [data-fs-field-errors]').innerText()).toContain(
			"Enter a valid email address."
		);
		expect((await page.locator("[data-fs-field-errors]").allTextContents()).join("")).toContain(
			"Enter at least two characters."
		);
		await assertAssociations(page);

		await page.getByLabel("Profile name", { exact: true }).fill("Grace");
		await page.getByLabel("Contact 2", { exact: true }).fill("second@example.com");
		const [accepted] = await Promise.all([
			page.waitForResponse(
				(response) => response.url() === url && response.request().method() === "POST"
			),
			page.getByRole("button", { name: "Save contacts" }).click(),
		]);
		expect(accepted.status()).toBe(200);
		expect(await accepted.json()).toMatchObject({ type: "success", status: 200 });
		await page.waitForFunction(
			() => document.querySelector('[data-testid="updates"]')?.textContent === "2"
		);
		expect(JSON.parse(await page.getByTestId("submission-data").innerText())).toEqual({
			profile: { name: "Grace" },
			contacts: [{ email: "added@example.com" }, { email: "second@example.com" }],
		});
		expect(await page.getByTestId("submission-valid").innerText()).toBe("true");
		expect(await page.locator("[aria-invalid]").count()).toBe(0);
		expect(
			(await page.locator("[data-fs-field-errors]").allTextContents()).join("").trim()
		).toBe("");
		await assertAssociations(page);
	});
});
