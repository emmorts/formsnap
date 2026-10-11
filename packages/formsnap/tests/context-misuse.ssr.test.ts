import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import ContextMisuse from "./fixtures/context-misuse.svelte";
import { reactivityData, reactivitySchema } from "./fixtures/reactivity-schema.js";

const fieldConsumers = [
	"description",
	"errors",
	"legend",
	"element",
	"control",
	"field-hook",
] as const;
const controlConsumers = ["label", "control-hook"] as const;

async function validatedForm() {
	return superValidate(reactivityData, zod(reactivitySchema));
}

describe("required provider diagnostics for real SSR consumers", () => {
	it.each(fieldConsumers)("reports the required field parent for %s", async (kind) => {
		const validated = await validatedForm();
		let failure: unknown;
		try {
			render(ContextMisuse, { props: { kind, validated } });
		} catch (error) {
			failure = error;
		}
		expect(failure).toBeInstanceOf(Error);
		expect(failure).not.toBeInstanceOf(TypeError);
		const message = (failure as Error).message;
		expect(message).toMatch(/require|must|within|inside|parent/i);
		for (const provider of ["Field", "Fieldset", "ElementField"]) {
			expect(message).toMatch(new RegExp(`\\b${provider}\\b`));
		}
	});

	it.each(controlConsumers)(
		"reports Control rather than accepting a Field parent for %s",
		async (kind) => {
			const validated = await validatedForm();
			let failure: unknown;
			try {
				render(ContextMisuse, { props: { kind, validated } });
			} catch (error) {
				failure = error;
			}
			expect(failure).toBeInstanceOf(Error);
			expect(failure).not.toBeInstanceOf(TypeError);
			expect((failure as Error).message).toMatch(/require|must|within|inside|parent/i);
			expect((failure as Error).message).toMatch(/\bControl\b/);
		}
	);
});
