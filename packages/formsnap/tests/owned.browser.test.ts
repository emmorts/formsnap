import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import OwnedForm from "../src/routes/owned/owned-form.svelte";
import { ownedSchema } from "../src/routes/owned/schema.js";
import { expectOwnedFixture } from "./owned-fixture.js";
import { describedIds, expectDescriptionTargets } from "./owned-associations.js";
import { danglingReferences, duplicateIds } from "./html.js";

let mounted: { invocationCounts(): Record<string, number> } | undefined;

beforeEach(async () => {
	const validated = await superValidate(
		{ email: "invalid", bio: "Hello", urls: ["invalid", "https://second.example"] },
		zod(ownedSchema)
	);
	mounted = mount(OwnedForm, { target: document.body, props: { validated } });
	flushSync();
});

afterEach(async () => {
	if (mounted) await unmount(mounted);
	mounted = undefined;
	document.body.innerHTML = "";
});

function click(text: string) {
	const button = [...document.querySelectorAll("button")].find(
		(element) => element.textContent?.trim() === text
	);
	expect(button).toBeDefined();
	button!.click();
	flushSync();
	expect(danglingReferences(document)).toEqual([]);
	expect(duplicateIds(document)).toEqual([]);
}

const control = (scope: string) => document.querySelector(`[data-scope="${scope}"] input`);

describe("scope-owned consumer regions", () => {
	it("renders unique targets, native group containment, custom error content and content exactly once", () => {
		expectOwnedFixture(document);
		expect(mounted?.invocationCounts()).toEqual({ description: 1, errors: 1 });
		expect(document.querySelector("[data-custom-error]")?.hasAttribute("data-fs-error")).toBe(
			true
		);
	});

	it("withdraws optional declarations with their containers and restores only the enabled targets", () => {
		const email = control("email");
		const inputId = email?.id;
		const errors = document.getElementById("owned-errors");
		click("Toggle owned description");
		expect(document.getElementById("owned-help")).toBeNull();
		expectDescriptionTargets(email, [errors]);
		click("Toggle owned errors");
		expect(document.getElementById("owned-errors")).toBeNull();
		expectDescriptionTargets(email, []);
		expect(email?.getAttribute("aria-invalid")).toBe("true");
		click("Rename owned IDs");
		expect(document.getElementById("renamed-owned-help")).toBeNull();
		expect(document.getElementById("renamed-owned-errors")).toBeNull();
		expectDescriptionTargets(email, []);
		click("Toggle owned description");
		expectDescriptionTargets(email, [document.getElementById("renamed-owned-help")]);
		click("Toggle owned errors");
		expectDescriptionTargets(email, [
			document.getElementById("renamed-owned-help"),
			document.getElementById("renamed-owned-errors"),
		]);
		expect(control("email")).toBe(email);
		expect(email?.id).toBe(inputId);
	});

	it("changes explicit IDs without replacing controls or targets and never leaks across forms", () => {
		const email = control("email");
		const help = document.getElementById("owned-help");
		const errors = document.getElementById("owned-errors");
		const parent = document.getElementById("owned-parent-help");
		const secondary = [
			...document.querySelectorAll('[data-testid="owned-secondary"] input'),
		].map(describedIds);
		click("Rename owned IDs");
		expect(document.getElementById("owned-help")).toBeNull();
		expect(document.getElementById("owned-errors")).toBeNull();
		expect(document.getElementById("owned-parent-help")).toBeNull();
		expect(document.getElementById("renamed-owned-help")).toBe(help);
		expect(document.getElementById("renamed-owned-errors")).toBe(errors);
		expect(document.getElementById("renamed-parent-help")).toBe(parent);
		expectDescriptionTargets(email, [help, errors]);
		expectDescriptionTargets(control("inherited"), [parent]);
		expect(
			[...document.querySelectorAll('[data-testid="owned-secondary"] input')].map(
				describedIds
			)
		).toEqual(secondary);
		expect(control("email")).toBe(email);
	});

	it("inherits declarative parent help, prefers local help and restores inheritance on removal", () => {
		const first = control("local");
		const second = control("inherited");
		const errors = document.querySelector('[data-scope="local"] [data-fs-field-errors]');
		const parent = document.getElementById("owned-parent-help");
		expectDescriptionTargets(first, [parent, errors]);
		click("Toggle local description");
		const local = document.getElementById("owned-local-help");
		expectDescriptionTargets(first, [local, errors]);
		expectDescriptionTargets(second, [parent]);
		click("Rename owned IDs");
		expectDescriptionTargets(first, [local, errors]);
		expectDescriptionTargets(second, [parent]);
		click("Toggle parent description");
		expectDescriptionTargets(first, [local, errors]);
		expectDescriptionTargets(second, []);
		click("Toggle local description");
		expect(document.getElementById("owned-local-help")).toBeNull();
		expectDescriptionTargets(first, [errors]);
		click("Toggle parent description");
		expectDescriptionTargets(first, [document.getElementById("renamed-parent-help"), errors]);
		expectDescriptionTargets(second, [document.getElementById("renamed-parent-help")]);
	});

	it("keeps enabled empty wrappers but only references errors while validation errors exist", () => {
		const email = control("email");
		const help = document.getElementById("owned-help");
		const errors = document.getElementById("owned-errors");
		const rowErrors = document.querySelector('[data-scope="local"] [data-fs-field-errors]');
		click("Clear errors");
		expect(document.getElementById("owned-errors")).toBe(errors);
		expect(document.querySelector('[data-scope="local"] [data-fs-field-errors]')).toBe(
			rowErrors
		);
		expect(errors?.querySelectorAll("[data-custom-error]")).toHaveLength(0);
		expectDescriptionTargets(email, [help]);
		expectDescriptionTargets(control("local"), [document.getElementById("owned-parent-help")]);
		expect(email?.hasAttribute("aria-invalid")).toBe(false);
		click("Restore errors");
		expectDescriptionTargets(email, [help, errors]);
		expectDescriptionTargets(control("local"), [
			document.getElementById("owned-parent-help"),
			rowErrors,
		]);
		expect(document.getElementById("owned-errors")).toBe(errors);
		expect(errors?.querySelector("[data-custom-error]")?.textContent).toContain(
			"Enter a valid email address."
		);
	});

	it("retains free-composed contributions alongside a managed target without duplicate registration", () => {
		const email = control("email");
		const help = document.getElementById("owned-help");
		const errors = document.getElementById("owned-errors");
		click("Toggle additional description");
		expectDescriptionTargets(email, [help, errors, document.getElementById("additional-help")]);
		click("Toggle owned description");
		expectDescriptionTargets(email, [errors, document.getElementById("additional-help")]);
		click("Toggle additional description");
		expectDescriptionTargets(email, [errors]);
		click("Toggle owned description");
		expectDescriptionTargets(email, [document.getElementById("owned-help"), errors]);
	});
});
