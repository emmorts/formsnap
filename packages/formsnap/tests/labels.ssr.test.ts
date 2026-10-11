import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { fixtureUrl } from "./fixture-url.js";
import { danglingReferences, duplicateIds, parseDocument } from "./html.js";

let browser: Browser;

beforeAll(async () => {
	browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
	await browser?.close();
});

function expectLabels(document: Document, headless: boolean) {
	const first = document.getElementById("first-label");
	const second = document.getElementById("second-label");
	expect(first?.tagName).toBe("LABEL");
	expect(second?.tagName).toBe("LABEL");
	for (const label of [first, second])
		expect(label?.getAttribute("for")).toBe("identity-control");
	if (headless) {
		expect(document.querySelector("[data-widget]")?.getAttribute("aria-labelledby")).toBe(
			"second-label"
		);
	} else {
		expect(document.querySelector("[data-native-control]")?.id).toBe("identity-control");
	}
	expect(duplicateIds(document)).toEqual([]);
	expect(danglingReferences(document)).toEqual([]);
}

describe("server-rendered label identity", () => {
	it.each([false, true])(
		"renders local label IDs and synchronous naming (headless=%s)",
		async (headless) => {
			const response = await fetch(
				new URL(`label-identity?headless=${headless}`, fixtureUrl())
			);
			expect(response.status).toBe(200);
			expectLabels(parseDocument(await response.text()), headless);
		}
	);

	it.each([false, true])(
		"retains SSR nodes and naming through hydration (headless=%s)",
		async (headless) => {
			const context = await browser.newContext();
			const page = await context.newPage();
			const diagnostics: string[] = [];
			page.on("console", (message) => {
				if (message.type() === "warning" || message.type() === "error") {
					diagnostics.push(`${message.type()}: ${message.text()}`);
				}
			});
			page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));
			let releaseScripts!: () => void;
			const scriptsReady = new Promise<void>((resolve) => {
				releaseScripts = resolve;
			});
			await page.route("**/*", async (route) => {
				if (route.request().resourceType() === "script") await scriptsReady;
				await route.continue();
			});
			try {
				const response = await page.goto(
					new URL(`label-identity?headless=${headless}`, fixtureUrl()).href,
					{ waitUntil: "commit" }
				);
				expect(response?.status()).toBe(200);
				await page.locator('[data-label-fixture][data-hydrated="false"]').waitFor();
				expectLabels(parseDocument(await page.content()), headless);
				await page.locator("[data-label-fixture] [id]").evaluateAll((elements) => {
					(window as Window & { labelSsrNodes?: Element[] }).labelSsrNodes = elements;
				});
				releaseScripts();
				await page.locator('[data-label-fixture][data-hydrated="true"]').waitFor();
				expectLabels(parseDocument(await page.content()), headless);
				expect(
					await page.locator("[data-label-fixture] [id]").evaluateAll((elements) => {
						const original = (window as Window & { labelSsrNodes?: Element[] })
							.labelSsrNodes;
						if (!original || elements.length !== original.length) return false;
						return elements.every((element, index) => element === original[index]);
					})
				).toBe(true);
				expect(await page.locator("[data-label-refs]").getAttribute("data-first-ref")).toBe(
					"first-label"
				);
				expect(
					await page.locator("[data-label-refs]").getAttribute("data-second-ref")
				).toBe("second-label");
				expect(diagnostics).toEqual([]);
			} finally {
				releaseScripts();
				await context.close();
			}
		}
	);
});
