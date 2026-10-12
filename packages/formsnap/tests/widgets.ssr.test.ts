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
	expect(diagnostics.filter((text) => !/Failed to load resource:.*400/.test(text))).toEqual([]);
});

const widgetsUrl = () => new URL("recipes/widgets", fixtureUrl()).href;
const nativeForm = (page: Page) => page.getByTestId("recipe-widgets-native");
const compositeForm = (page: Page) => page.getByTestId("recipe-widgets-composite");
const standard = (page: Page) =>
	page.getByRole("radio", { name: "Standard delivery", exact: true });
const express = (page: Page) => page.getByRole("radio", { name: "Express delivery", exact: true });
const channels = (page: Page) =>
	page.getByRole("listbox", { name: "Notification channels", exact: true });
const trigger = (page: Page) => page.getByRole("button", { name: "Collection point", exact: true });
const transport = (page: Page) =>
	compositeForm(page).locator('input[type="hidden"][name="collection"]');

async function openPage(javaScriptEnabled = true) {
	context = await browser.newContext({ javaScriptEnabled });
	const page = await context.newPage();
	page.on("console", (message) => {
		if (message.type() === "warning" || message.type() === "error") {
			diagnostics.push(`${message.type()}: ${message.text()}`);
		}
	});
	page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
	await page.goto(widgetsUrl());
	if (javaScriptEnabled) {
		await compositeForm(page).and(page.locator('[data-hydrated="true"]')).waitFor();
	}
	return page;
}

async function assertReferences(page: Page) {
	const htmlDocument = parseDocument(await page.content());
	expect(duplicateIds(htmlDocument)).toEqual([]);
	expect(danglingReferences(htmlDocument)).toEqual([]);
}

async function regions(control: Locator) {
	return control.evaluate((element) =>
		(element.getAttribute("aria-describedby") ?? "")
			.split(/\s+/)
			.filter(Boolean)
			.map((id) => {
				const region = document.getElementById(id);
				return {
					text: region?.textContent?.trim(),
					error: region?.hasAttribute("data-fs-field-errors"),
				};
			})
	);
}

async function selectedChannels(page: Page) {
	return channels(page).evaluate((element: HTMLSelectElement) =>
		Array.from(element.selectedOptions, (option) => option.value)
	);
}

async function submit(page: Page, action: "native" | "composite") {
	const [response] = await Promise.all([
		page.waitForResponse(
			(candidate) =>
				candidate.request().method() === "POST" &&
				candidate.url() === `${widgetsUrl()}?/${action}`
		),
		page
			.getByRole("button", {
				name: action === "native" ? "Save native preferences" : "Save collection point",
				exact: true,
			})
			.click(),
	]);
	const body = await response.json();
	// SvelteKit 3 returns the `fail` status for enhanced submissions, so the HTTP status now
	// matches the status encoded in the ActionResult body instead of always being 200.
	expect(response.status()).toBe(body.status);
	expect(response.request().headers()["x-sveltekit-action"]).toBe("true");
	expect(response.request().isNavigationRequest()).toBe(false);
	return body;
}

async function focused(control: Locator) {
	return control.evaluate((element) => element === document.activeElement);
}

async function highlighted(page: Page) {
	return trigger(page).evaluate((element) => {
		const id = element.getAttribute("aria-activedescendant");
		return id ? document.getElementById(id)?.textContent?.trim() : null;
	});
}

async function chooseEastWithKeyboard(page: Page) {
	await page.getByRole("button", { name: "Focus collection point", exact: true }).click();
	expect(await focused(trigger(page))).toBe(true);
	await trigger(page).press("ArrowDown");
	await expect.poll(() => trigger(page).getAttribute("aria-expanded")).toBe("true");
	await expect.poll(() => highlighted(page)).toBe("Central depot");
	const unavailable = page.getByRole("option", { name: "Closed depot", exact: true });
	expect(await unavailable.getAttribute("data-disabled")).toBe("");
	await trigger(page).press("ArrowDown");
	// The library must skip the disabled constituent item, not just hide it visually.
	await expect.poll(() => highlighted(page)).toBe("East depot");
	expect(await focused(trigger(page))).toBe(true);
	await trigger(page).press("Enter");
	await expect.poll(() => transport(page).inputValue()).toBe("east");
	await expect.poll(() => trigger(page).getAttribute("aria-expanded")).toBe("false");
	expect(await trigger(page).innerText()).toBe("East depot");
	expect(await focused(trigger(page))).toBe(true);
}

describe("native and library-owned widgets", () => {
	it("renders native and composite naming, unique target IDs and descriptions before hydration", async () => {
		const page = await openPage(false);
		expect(await nativeForm(page).getAttribute("data-hydrated")).toBe("false");
		expect(
			await page
				.getByRole("group", { name: "Delivery speed", exact: true })
				.evaluate((element) => element.tagName)
		).toBe("FIELDSET");
		for (const radio of [standard(page), express(page)]) {
			const id = await radio.getAttribute("id");
			expect(await page.locator(`label[for="${id}"]`).count()).toBe(1);
			expect(await radio.getAttribute("name")).toBe("delivery");
			expect(await regions(radio)).toEqual([
				{ text: "Choose standard or express delivery.", error: false },
			]);
		}
		expect(await standard(page).getAttribute("id")).not.toBe(
			await express(page).getAttribute("id")
		);
		expect(await channels(page).getAttribute("multiple")).not.toBeNull();
		expect(await page.locator('label[for="widgets-channels"]').innerText()).toBe(
			"Notification channels"
		);
		expect(await regions(channels(page))).toEqual([
			{ text: "Choose one or two notification channels.", error: false },
		]);
		expect(await trigger(page).getAttribute("id")).toBe("widgets-collection");
		const labelId = await trigger(page).getAttribute("aria-labelledby");
		expect(await page.locator(`[id="${labelId}"]`).innerText()).toBe("Collection point");
		expect(await regions(trigger(page))).toEqual([
			{ text: "Choose an open depot for collection.", error: false },
		]);
		expect(await trigger(page).getAttribute("aria-haspopup")).toBe("listbox");
		expect(await trigger(page).getAttribute("aria-expanded")).toBe("false");
		expect(await trigger(page).isDisabled()).toBe(true);
		expect(await transport(page).count()).toBe(1);
		expect(await transport(page).isDisabled()).toBe(true);
		expect(
			await transport(page).evaluate((element) =>
				element
					.getAttributeNames()
					.filter(
						(name) =>
							name === "id" || name.startsWith("aria-") || name.startsWith("data-fs-")
					)
			)
		).toEqual([]);
		await assertReferences(page);
	});

	it("submits radios and repeated multiple-select values through a real native action without JavaScript", async () => {
		const page = await openPage(false);
		const save = page.getByRole("button", { name: "Save native preferences", exact: true });
		const [rejected] = await Promise.all([page.waitForNavigation(), save.click()]);
		expect(rejected?.status()).toBe(400);
		for (const radio of [standard(page), express(page)]) {
			expect(await radio.getAttribute("aria-invalid")).toBe("true");
			expect(await regions(radio)).toEqual([
				{ text: "Choose standard or express delivery.", error: false },
				{ text: "Choose a delivery speed.", error: true },
			]);
		}
		expect(await regions(channels(page))).toEqual([
			{ text: "Choose one or two notification channels.", error: false },
			{ text: "Choose at least one notification channel.", error: true },
		]);
		await express(page).check();
		expect(await standard(page).isChecked()).toBe(false);
		await channels(page).selectOption(["email", "sms"]);
		const [accepted] = await Promise.all([page.waitForNavigation(), save.click()]);
		expect(accepted?.status()).toBe(200);
		expect(await express(page).isChecked()).toBe(true);
		expect(await selectedChannels(page)).toEqual(["email", "sms"]);
		expect(await nativeForm(page).locator("[aria-invalid]").count()).toBe(0);
		expect(await trigger(page).isDisabled()).toBe(true);
		await assertReferences(page);
	});

	it("rejects forged unavailable widget values and renders their associations in server HTML", async () => {
		await openPage(false);
		const response = await context!.request.post(`${widgetsUrl()}?/composite`, {
			headers: { accept: "text/html", origin: new URL(widgetsUrl()).origin },
			multipart: { collection: "closed" },
		});
		expect(response.status()).toBe(400);
		const htmlDocument = parseDocument(await response.text());
		expect(duplicateIds(htmlDocument)).toEqual([]);
		expect(danglingReferences(htmlDocument)).toEqual([]);
		const control = htmlDocument.getElementById("widgets-collection");
		expect(control?.getAttribute("aria-invalid")).toBe("true");
		const ids = (control?.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
		expect(ids.map((id) => htmlDocument.getElementById(id)?.textContent?.trim())).toEqual([
			"Choose an open depot for collection.",
			"Choose an open collection point.",
		]);
	});

	it("retains native selections on a rejected cardinality constraint, then corrects and resets them", async () => {
		const page = await openPage();
		await standard(page).check();
		await channels(page).selectOption(["email", "sms", "push"]);
		expect(await submit(page, "native")).toMatchObject({ type: "failure", status: 400 });
		await expect.poll(() => channels(page).getAttribute("aria-invalid")).toBe("true");
		expect(await selectedChannels(page)).toEqual(["email", "sms", "push"]);
		expect(await standard(page).getAttribute("aria-invalid")).toBeNull();
		expect(await regions(channels(page))).toEqual([
			{ text: "Choose one or two notification channels.", error: false },
			{ text: "Choose no more than two notification channels.", error: true },
		]);
		await channels(page).selectOption(["push"]);
		expect(await submit(page, "native")).toMatchObject({ type: "success", status: 200 });
		await page.getByTestId("widgets-native-message").waitFor();
		await page.getByRole("button", { name: "Reset native preferences", exact: true }).click();
		await expect.poll(() => selectedChannels(page)).toEqual([]);
		expect(await standard(page).isChecked()).toBe(false);
		expect(await express(page).isChecked()).toBe(false);
		expect(await nativeForm(page).locator("[aria-invalid]").count()).toBe(0);
		await assertReferences(page);
	});

	it("uses the real widget's keyboard, disabled-item skipping, bound focus ref and enhanced action errors", async () => {
		const page = await openPage();
		const original = await trigger(page).elementHandle();
		const labelId = await trigger(page).getAttribute("aria-labelledby");
		expect(await trigger(page).isDisabled()).toBe(false);
		expect(await submit(page, "composite")).toMatchObject({ type: "failure", status: 400 });
		await expect.poll(() => trigger(page).getAttribute("aria-invalid")).toBe("true");
		expect(await regions(trigger(page))).toEqual([
			{ text: "Choose an open depot for collection.", error: false },
			{ text: "Choose a collection point.", error: true },
		]);
		await chooseEastWithKeyboard(page);
		await assertReferences(page);
		expect(await submit(page, "composite")).toMatchObject({ type: "success", status: 200 });
		await page.getByTestId("widgets-composite-message").waitFor();
		await expect.poll(() => trigger(page).getAttribute("aria-invalid")).toBeNull();
		expect(await regions(trigger(page))).toEqual([
			{ text: "Choose an open depot for collection.", error: false },
		]);
		expect(await trigger(page).getAttribute("aria-labelledby")).toBe(labelId);
		expect(
			await trigger(page).evaluate((element, previous) => element === previous, original)
		).toBe(true);
		await page.getByRole("button", { name: "Reset collection point", exact: true }).click();
		await expect.poll(() => transport(page).inputValue()).toBe("");
		expect(await trigger(page).innerText()).toBe("Choose a collection point");
		expect(await compositeForm(page).locator("[aria-invalid]").count()).toBe(0);
		await page.getByRole("button", { name: "Focus collection point", exact: true }).click();
		await trigger(page).press("c");
		// Closed-menu typeahead is also library-owned and must not choose Closed depot.
		await expect.poll(() => transport(page).inputValue()).toBe("central");
		await trigger(page).press("Tab");
		expect(
			await focused(page.getByRole("button", { name: "Save collection point", exact: true }))
		).toBe(true);
		await assertReferences(page);
	});

	it("disables actual native controls and widget transport, then proves omitted values reach the action", async () => {
		const page = await openPage();
		await express(page).check();
		await channels(page).selectOption(["sms"]);
		await chooseEastWithKeyboard(page);
		await page.getByRole("checkbox", { name: "Disable native controls", exact: true }).check();
		await page.getByRole("checkbox", { name: "Disable composite select", exact: true }).check();
		await expect.poll(() => trigger(page).isDisabled()).toBe(true);
		expect(await express(page).isDisabled()).toBe(true);
		expect(await channels(page).isDisabled()).toBe(true);
		expect(await transport(page).isDisabled()).toBe(true);
		expect(await express(page).isChecked()).toBe(true);
		expect(await transport(page).inputValue()).toBe("east");
		expect(
			await nativeForm(page).evaluate((element: HTMLFormElement) => {
				const data = new FormData(element);
				return [data.has("delivery"), data.has("channels")];
			})
		).toEqual([false, false]);
		expect(
			await compositeForm(page).evaluate((element: HTMLFormElement) =>
				new FormData(element).has("collection")
			)
		).toBe(false);
		// Restore before posting: disabling is not an implicit reset of application selection.
		await page
			.getByRole("checkbox", { name: "Disable composite select", exact: true })
			.uncheck();
		expect(await transport(page).inputValue()).toBe("east");
		await page.getByRole("checkbox", { name: "Disable composite select", exact: true }).check();
		expect(await submit(page, "composite")).toMatchObject({ type: "failure", status: 400 });
		await expect.poll(() => trigger(page).getAttribute("aria-invalid")).toBe("true");
		expect(await regions(trigger(page))).toContainEqual({
			text: "Choose a collection point.",
			error: true,
		});
		expect(await submit(page, "native")).toMatchObject({ type: "failure", status: 400 });
		await expect.poll(() => channels(page).getAttribute("aria-invalid")).toBe("true");
		expect(await regions(standard(page))).toContainEqual({
			text: "Choose a delivery speed.",
			error: true,
		});
		await page
			.getByRole("checkbox", { name: "Disable composite select", exact: true })
			.uncheck();
		await chooseEastWithKeyboard(page);
		expect(await submit(page, "composite")).toMatchObject({ type: "success", status: 200 });
		await page.getByTestId("widgets-composite-message").waitFor();
		await assertReferences(page);
	});
});
