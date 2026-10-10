import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
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
	// Native rejected actions return HTTP 400, but application diagnostics still fail the test.
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

const groupsUrl = () => new URL("recipes/groups", fixtureUrl()).href;
const form = (page: Page) => page.getByTestId("recipe-groups");
const nativeControl = (page: Page) =>
	page.getByRole("checkbox", { name: "Accept native terms", exact: true });
const customControl = (page: Page) =>
	page.getByRole("checkbox", { name: "Accept custom terms", exact: true });

async function hydrated(page: Page) {
	await page.goto(groupsUrl());
	await form(page).and(page.locator('[data-hydrated="true"]')).waitFor();
}

async function assertReferences(page: Page) {
	const htmlDocument = parseDocument(await page.content());
	expect(duplicateIds(htmlDocument)).toEqual([]);
	expect(danglingReferences(htmlDocument)).toEqual([]);
}

async function associatedRegions(control: Locator) {
	return control.evaluate((element) =>
		(element.getAttribute("aria-describedby") ?? "")
			.split(/\s+/)
			.filter(Boolean)
			.map((id) => {
				const region = document.getElementById(id);
				return {
					id,
					text: region?.textContent?.trim() ?? null,
					errors: region?.hasAttribute("data-fs-field-errors") ?? false,
				};
			})
	);
}

async function submit(page: Page) {
	const [response] = await Promise.all([
		page.waitForResponse(
			(candidate) =>
				candidate.url() === groupsUrl() && candidate.request().method() === "POST"
		),
		page.getByRole("button", { name: "Save agreements", exact: true }).click(),
	]);
	expect(response.status()).toBe(200);
	expect(response.request().headers()["x-sveltekit-action"]).toBe("true");
	expect(response.request().isNavigationRequest()).toBe(false);
	return response.json();
}

async function assertInvalidAssociations(page: Page) {
	for (const [control, description, message] of [
		[nativeControl(page), "Accept the native terms before saving.", "Accept the native terms."],
		[customControl(page), "Accept the custom terms before saving.", "Accept the custom terms."],
	] as const) {
		await expect
			.poll(() => control.getAttribute("aria-invalid"), { timeout: 10000 })
			.toBe("true");
		await expect
			.poll(async () => (await associatedRegions(control)).map(({ text }) => text), {
				timeout: 10000,
			})
			.toEqual([description, message]);
		expect((await associatedRegions(control)).map(({ errors }) => errors)).toEqual([
			false,
			true,
		]);
	}
	await assertReferences(page);
}

describe("native and custom agreement groups", () => {
	it("opens the groups recipe from the index without JavaScript", async () => {
		const page = await openPage(false);
		await page.goto(new URL("recipes/", fixtureUrl()).href);
		const links = page.getByRole("link");
		const target = await links.evaluateAll(
			(elements, expected) =>
				elements.findIndex((element) => (element as HTMLAnchorElement).href === expected),
			groupsUrl()
		);
		expect(target).toBeGreaterThanOrEqual(0);
		await Promise.all([page.waitForNavigation(), links.nth(target).click()]);
		expect(page.url()).toBe(groupsUrl());
		expect(await form(page).count()).toBe(1);
	});

	it("renders accessible groups and caller-owned associations in initial server HTML", async () => {
		const page = await openPage(false);
		const response = await page.goto(groupsUrl());
		expect(response?.status()).toBe(200);
		expect(await form(page).getAttribute("data-hydrated")).toBe("false");
		await assertReferences(page);
		const native = page.getByRole("group", { name: "Native agreement", exact: true });
		const custom = page.getByRole("group", { name: "Custom agreement", exact: true });
		expect(await native.getAttribute("data-testid")).toBe("native-group");
		expect(await native.evaluate((element) => element.tagName)).toBe("FIELDSET");
		expect(await native.locator("legend").innerText()).toBe("Native agreement");
		expect(await custom.getAttribute("data-testid")).toBe("custom-group");
		expect(await custom.evaluate((element) => element.tagName)).toBe("DIV");
		expect(await custom.getAttribute("aria-disabled")).toBe("false");
		expect(
			await custom.getByRole("heading", { name: "Custom agreement", exact: true }).isVisible()
		).toBe(true);
		expect(await page.getByTestId("custom-errors").innerText()).toBe("");
		expect(await nativeControl(page).isChecked()).toBe(false);
		expect(await customControl(page).getAttribute("aria-checked")).toBe("false");
		expect(await customControl(page).evaluate((element) => element.tagName)).toBe("BUTTON");
		expect(await customControl(page).getAttribute("type")).toBe("button");
		const labelId = await customControl(page).getAttribute("aria-labelledby");
		expect(await page.locator(`[id="${labelId}"]`).innerText()).toBe("Accept custom terms");
		const nativeId = await nativeControl(page).getAttribute("id");
		expect(await page.locator(`label[for="${nativeId}"]`).innerText()).toBe(
			"Accept native terms"
		);
		expect((await associatedRegions(nativeControl(page))).map(({ text }) => text)).toEqual([
			"Accept the native terms before saving.",
		]);
		expect(
			(await associatedRegions(customControl(page))).map(({ text, errors }) => ({
				text,
				errors,
			}))
		).toEqual([{ text: "Accept the custom terms before saving.", errors: false }]);
		const transport = form(page).locator('input[type="hidden"][name="customAccepted"]');
		expect(await transport.count()).toBe(1);
		expect(await transport.inputValue()).toBe("false");
		expect(
			await transport.evaluate((element) =>
				element
					.getAttributeNames()
					.filter(
						(name) =>
							name === "id" || name.startsWith("aria-") || name.startsWith("data-fs-")
					)
			)
		).toEqual([]);
		expect(await form(page).locator("[aria-invalid]").count()).toBe(0);
		expect(await form(page).locator("[data-fs-error]").count()).toBe(0);
	});

	it("keeps actual nodes, ids and associations through hydration", async () => {
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
			await page.goto(groupsUrl(), { waitUntil: "commit" });
			await form(page).and(page.locator('[data-hydrated="false"]')).waitFor();
			const capture = () =>
				form(page)
					.locator("[id]")
					.evaluateAll((elements) =>
						elements.map((element) => ({
							id: element.id,
							labelledBy: element.getAttribute("aria-labelledby"),
							describedBy: element.getAttribute("aria-describedby"),
							invalid: element.getAttribute("aria-invalid"),
						}))
					);
			const before = await capture();
			await form(page)
				.locator("[id]")
				.evaluateAll((elements) => {
					(window as Window & { groupSsrNodes?: Element[] }).groupSsrNodes = elements;
				});
			releaseScripts();
			await form(page).and(page.locator('[data-hydrated="true"]')).waitFor();
			expect(await capture()).toEqual(before);
			expect(
				await form(page)
					.locator("[id]")
					.evaluateAll((elements) =>
						elements.every(
							(element, index) =>
								element ===
								(window as Window & { groupSsrNodes?: Element[] }).groupSsrNodes?.[
									index
								]
						)
					)
			).toBe(true);
			await assertReferences(page);
		} finally {
			releaseScripts();
		}
	});

	it("renders invalid native POST errors and keeps the native checkbox usable without JavaScript", async () => {
		const page = await openPage(false);
		await page.goto(groupsUrl());
		const rejected = await context!.request.post(groupsUrl(), {
			headers: { accept: "text/html", origin: new URL(groupsUrl()).origin },
			multipart: { nativeAccepted: "false", customAccepted: "false" },
		});
		expect(rejected.status()).toBe(400);
		const htmlDocument = parseDocument(await rejected.text());
		expect(duplicateIds(htmlDocument)).toEqual([]);
		expect(danglingReferences(htmlDocument)).toEqual([]);
		for (const [group, control, message] of [
			[
				'[data-testid="native-group"]',
				'input[name="nativeAccepted"]',
				"Accept the native terms.",
			],
			['[data-testid="custom-group"]', 'button[role="checkbox"]', "Accept the custom terms."],
		] as const) {
			const renderedGroup = htmlDocument.querySelector(group);
			const renderedControl = htmlDocument.querySelector(control);
			expect(renderedGroup?.textContent).toContain(message);
			expect(renderedGroup?.hasAttribute("data-fs-error")).toBe(true);
			expect(renderedControl?.getAttribute("aria-invalid")).toBe("true");
			const references = (renderedControl?.getAttribute("aria-describedby") ?? "")
				.split(/\s+/)
				.filter(Boolean);
			expect(
				references.map((id) => htmlDocument.getElementById(id)?.textContent?.trim())
			).toEqual([
				group.includes("native")
					? "Accept the native terms before saving."
					: "Accept the custom terms before saving.",
				message,
			]);
		}
		// The role widget has no no-JavaScript toggle. The real checkbox still submits true.
		await nativeControl(page).check();
		const [nativeSubmission] = await Promise.all([
			page.waitForNavigation(),
			page.getByRole("button", { name: "Save agreements", exact: true }).click(),
		]);
		expect(nativeSubmission?.status()).toBe(400);
		expect(await nativeControl(page).isChecked()).toBe(true);
		expect(await nativeControl(page).getAttribute("aria-invalid")).toBeNull();
		expect(await page.getByTestId("native-group").getAttribute("data-fs-error")).toBeNull();
		expect(await page.getByTestId("custom-errors").innerText()).toBe(
			"Accept the custom terms."
		);
		expect(await customControl(page).getAttribute("aria-checked")).toBe("false");
		expect(await form(page).locator('input[name="customAccepted"]').inputValue()).toBe("false");
		await assertReferences(page);
	});

	it("uses button Space and Enter activation, tab order and the bound focus ref", async () => {
		const page = await openPage();
		await hydrated(page);
		let posted = 0;
		page.on("request", (request) => {
			if (request.method() === "POST") posted += 1;
		});
		await nativeControl(page).focus();
		await page.keyboard.press("Tab");
		expect(
			await customControl(page).evaluate((element) => element === document.activeElement)
		).toBe(true);
		await page.keyboard.press("Space");
		await expect.poll(() => customControl(page).getAttribute("aria-checked")).toBe("true");
		expect(await form(page).locator('input[name="customAccepted"]').inputValue()).toBe("true");
		await page.keyboard.press("Enter");
		await expect.poll(() => customControl(page).getAttribute("aria-checked")).toBe("false");
		expect(await form(page).locator('input[name="customAccepted"]').inputValue()).toBe("false");
		await page.keyboard.press("Tab");
		expect(
			await page
				.getByRole("button", { name: "Save agreements", exact: true })
				.evaluate((element) => element === document.activeElement)
		).toBe(true);
		await page.keyboard.press("Shift+Tab");
		expect(
			await customControl(page).evaluate((element) => element === document.activeElement)
		).toBe(true);
		await page.getByRole("button", { name: "Focus custom control", exact: true }).click();
		expect(
			await customControl(page).evaluate((element) => element === document.activeElement)
		).toBe(true);
		expect(posted).toBe(0);
	});

	it("disables real descendants and excludes their transport while preserving values", async () => {
		const page = await openPage();
		await hydrated(page);
		await nativeControl(page).check();
		await customControl(page).click();
		await expect.poll(() => customControl(page).getAttribute("aria-checked")).toBe("true");
		const toggle = page.getByRole("checkbox", { name: "Disable groups", exact: true });
		expect(await toggle.evaluate((element: HTMLInputElement) => element.form)).toBeNull();
		expect(
			await page
				.getByRole("button", { name: "Focus custom control", exact: true })
				.evaluate((element: HTMLButtonElement) => element.form)
		).toBeNull();
		await toggle.check();
		await expect
			.poll(() => page.getByTestId("custom-group").getAttribute("aria-disabled"))
			.toBe("true");
		expect(
			await page
				.getByTestId("native-group")
				.evaluate((element: HTMLFieldSetElement) => element.disabled)
		).toBe(true);
		expect(await nativeControl(page).isDisabled()).toBe(true);
		expect(await nativeControl(page).evaluate((element) => element.matches(":disabled"))).toBe(
			true
		);
		expect(await customControl(page).isDisabled()).toBe(true);
		expect(
			await customControl(page).evaluate((element: HTMLButtonElement) => element.disabled)
		).toBe(true);
		expect(await form(page).locator('input[name="customAccepted"]').isDisabled()).toBe(true);
		expect(
			await form(page).evaluate((element: HTMLFormElement) => {
				const data = new FormData(element);
				return [data.has("nativeAccepted"), data.has("customAccepted")];
			})
		).toEqual([false, false]);
		await customControl(page).click({ force: true });
		expect(await customControl(page).getAttribute("aria-checked")).toBe("true");
		await page.getByRole("button", { name: "Focus custom control", exact: true }).focus();
		await page.keyboard.press("Tab");
		expect(
			await page
				.getByRole("button", { name: "Save agreements", exact: true })
				.evaluate((element) => element === document.activeElement)
		).toBe(true);
		await toggle.uncheck();
		await expect
			.poll(() => page.getByTestId("custom-group").getAttribute("aria-disabled"))
			.toBe("false");
		expect(await nativeControl(page).isDisabled()).toBe(false);
		expect(await customControl(page).isDisabled()).toBe(false);
		expect(await nativeControl(page).isChecked()).toBe(true);
		expect(await customControl(page).getAttribute("aria-checked")).toBe("true");
		expect(
			await form(page).evaluate((element: HTMLFormElement) => {
				const data = new FormData(element);
				return [data.get("nativeAccepted"), data.get("customAccepted")];
			})
		).toEqual(["on", "true"]);
	});

	it("matches native/custom error styling across enhanced invalid, partial and corrected POSTs", async () => {
		const page = await openPage();
		await hydrated(page);
		const controlNode = await customControl(page).elementHandle();
		expect(await submit(page)).toMatchObject({ type: "failure", status: 400 });
		await assertInvalidAssociations(page);
		expect(await nativeControl(page).isChecked()).toBe(false);
		expect(await customControl(page).getAttribute("aria-checked")).toBe("false");
		expect(await form(page).locator('input[name="customAccepted"]').inputValue()).toBe("false");
		// CI captures the actual invalid surface before the regression assertion, even if it fails.
		await page.screenshot({ path: "/tmp/formsnap-groups.png", fullPage: true });
		expect(await page.getByTestId("native-group").getAttribute("data-fs-error")).toBe("");
		// Focused regression: before the Fieldset fix, native has this marker and custom lacks it.
		expect(await page.getByTestId("custom-group").getAttribute("data-fs-error")).toBe("");
		const customErrorId = await page.getByTestId("custom-errors").getAttribute("id");
		await nativeControl(page).check();
		expect(await submit(page)).toMatchObject({ type: "failure", status: 400 });
		await expect
			.poll(() => page.getByTestId("native-group").getAttribute("data-fs-error"), {
				timeout: 10000,
			})
			.toBeNull();
		expect(await nativeControl(page).getAttribute("aria-invalid")).toBeNull();
		expect((await associatedRegions(nativeControl(page))).map(({ text }) => text)).toEqual([
			"Accept the native terms before saving.",
		]);
		expect(await page.getByTestId("custom-group").getAttribute("data-fs-error")).toBe("");
		expect(await customControl(page).getAttribute("aria-invalid")).toBe("true");
		expect(await page.getByTestId("custom-errors").innerText()).toBe(
			"Accept the custom terms."
		);
		await customControl(page).press("Space");
		await expect.poll(() => customControl(page).getAttribute("aria-checked")).toBe("true");
		// Only the action accepting both true-refined booleans can produce this success result.
		expect(await submit(page)).toMatchObject({ type: "success", status: 200 });
		await page.getByTestId("groups-message").waitFor();
		expect(await page.getByTestId("groups-message").innerText()).toBe("Agreements saved.");
		await expect
			.poll(() => form(page).locator("[data-fs-error]").count(), { timeout: 10000 })
			.toBe(0);
		expect(await form(page).locator("[aria-invalid]").count()).toBe(0);
		expect(await page.getByTestId("custom-errors").getAttribute("id")).toBe(customErrorId);
		expect(await page.getByTestId("custom-errors").innerText()).toBe("");
		expect((await associatedRegions(customControl(page))).map(({ text }) => text)).toEqual([
			"Accept the custom terms before saving.",
		]);
		expect(await nativeControl(page).isChecked()).toBe(true);
		expect(await customControl(page).getAttribute("aria-checked")).toBe("true");
		expect(await form(page).locator('input[name="customAccepted"]').inputValue()).toBe("true");
		expect(
			await customControl(page).evaluate(
				(element, previous) => element === previous,
				controlNode
			)
		).toBe(true);
		await assertReferences(page);
	});
});
