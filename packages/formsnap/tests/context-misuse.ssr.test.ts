import { describe, expect, it } from "vitest";
import { fixtureUrl } from "./fixture-url.js";
import { parseDocument } from "./html.js";

const fieldConsumers = [
	"description",
	"errors",
	"legend",
	"element",
	"control",
	"field-hook",
] as const;
const controlConsumers = ["label", "control-hook"] as const;

async function requiredParentMessage(kind: string) {
	const url = new URL("context-misuse", fixtureUrl());
	url.searchParams.set("kind", kind);
	const response = await fetch(url);
	expect(response.status).toBe(200);
	const document = parseDocument(await response.text());
	const failure = document.querySelector("[data-context-error]");
	expect(failure, `SSR diagnostic for ${kind}`).not.toBeNull();
	expect(failure!.getAttribute("data-error-type")).not.toBe("TypeError");
	return failure!.textContent ?? "";
}

describe("required provider diagnostics for real SSR consumers", () => {
	it.each(fieldConsumers)("reports the required field parent for %s", async (kind) => {
		const message = await requiredParentMessage(kind);
		expect(message).toMatch(/require|must|within|inside|parent/i);
		for (const provider of ["Field", "Fieldset", "ElementField"]) {
			expect(message).toMatch(new RegExp(`\\b${provider}\\b`));
		}
	});

	it.each(controlConsumers)(
		"reports Control rather than accepting a Field parent for %s",
		async (kind) => {
			const message = await requiredParentMessage(kind);
			expect(message).toMatch(/require|must|within|inside|parent/i);
			expect(message).toMatch(/\bControl\b/);
		}
	);
});
