import { expect } from "vitest";

export function describedIds(element: Element | null): string[] {
	return (element?.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
}

/** Assert targets from the consumer's rendered scope, independently of the control's attributes. */
export function expectDescriptionTargets(element: Element | null, targets: Array<Element | null>) {
	expect(element).not.toBeNull();
	for (const target of targets) {
		expect(target).not.toBeNull();
		expect(target?.id).toBeTruthy();
	}
	expect(describedIds(element).sort()).toEqual(targets.map((target) => target!.id).sort());
}

/** Settings, arrays and JSON intentionally render their owned regions after the control. */
export function expectFixtureAssociations(document: Document) {
	for (const control of document.querySelectorAll("form input, form textarea")) {
		const row = control.closest("[data-row]");
		const description = row
			? control.closest("fieldset")!.querySelector(":scope > [data-fs-description]")
			: control.nextElementSibling;
		expect(description?.hasAttribute("data-fs-description")).toBe(true);
		const errors = row ? control.nextElementSibling : description!.nextElementSibling;
		expect(errors?.hasAttribute("data-fs-field-errors")).toBe(true);
		const invalid = control.getAttribute("aria-invalid") === "true";
		if (invalid) expect(errors?.textContent?.trim()).toBeTruthy();
		else expect(errors?.textContent?.trim()).toBe("");
		expectDescriptionTargets(control, invalid ? [description, errors] : [description]);
	}
	for (const fieldset of document.querySelectorAll("fieldset")) {
		expect(fieldset.querySelector(":scope > [data-fs-description]")).not.toBeNull();
		expect(fieldset.querySelector(":scope > [data-fs-field-errors]")).not.toBeNull();
	}
}
