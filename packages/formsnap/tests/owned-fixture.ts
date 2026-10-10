import { expect } from "vitest";
import { expectDescriptionTargets } from "./owned-associations.js";
import { danglingReferences, duplicateIds } from "./html.js";

export function expectOwnedFixture(document: Document, localInitially = false) {
	const scope = (name: string) => document.querySelector(`[data-scope="${name}"]`)!;
	const email = scope("email");
	const help = email.querySelector("[data-fs-description]");
	const errors = email.querySelector("[data-fs-field-errors]");
	expect(help?.id).toBe("owned-help");
	expect(errors?.id).toBe("owned-errors");
	expectDescriptionTargets(email.querySelector("input"), [help, errors]);
	expect(errors?.getAttribute("aria-live")).toBe("assertive");
	expect(errors?.querySelector("[data-custom-error]")?.textContent).toContain(
		"Enter a valid email address."
	);
	expectDescriptionTargets(scope("disabled").querySelector("input"), []);
	expect(
		scope("disabled").querySelector("[data-fs-description], [data-fs-field-errors]")
	).toBeNull();
	expect(document.getElementById("unused-help")).toBeNull();
	expect(document.getElementById("unused-errors")).toBeNull();
	const group = document.querySelector("fieldset")!;
	const parent = group.querySelector(":scope > [data-fs-description]");
	const groupErrors = group.querySelector(":scope > [data-fs-field-errors]");
	expect(parent?.id).toBe("owned-parent-help");
	expect(groupErrors?.id).toBe("owned-group-errors");
	expect(groupErrors?.textContent).toContain("Enter three URLs.");
	expect(groupErrors?.parentElement).toBe(group);
	expect(parent?.parentElement).toBe(group);
	const local = document.getElementById("owned-local-help");
	if (localInitially) expect(local?.parentElement).toBe(scope("local"));
	else expect(local).toBeNull();
	expectDescriptionTargets(scope("local").querySelector("input"), [
		localInitially ? local : parent,
		scope("local").querySelector("[data-fs-field-errors]"),
	]);
	expectDescriptionTargets(scope("inherited").querySelector("input"), [parent]);
	expectDescriptionTargets(scope("explicit").querySelector("input"), [
		document.getElementById("caller-owned-help"),
	]);
	const other = document.querySelector('[data-testid="owned-secondary"]')!;
	const otherControls = [...other.querySelectorAll("input")];
	const otherDescriptions = [...other.querySelectorAll("[data-fs-description]")];
	const otherErrors = [...other.querySelectorAll("[data-fs-field-errors]")];
	expect(otherControls).toHaveLength(2);
	for (let index = 0; index < otherControls.length; index++) {
		expectDescriptionTargets(otherControls[index]!, [
			otherDescriptions[index]!,
			otherErrors[index]!,
		]);
	}
	expect(duplicateIds(document)).toEqual([]);
	expect(danglingReferences(document)).toEqual([]);
	for (const name of ["description", "errors"]) {
		const executions = document.querySelectorAll(`[data-execution="${name}"]`);
		expect(executions).toHaveLength(1);
		expect(executions[0]?.textContent).toBe("1");
	}
}
