import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import SettingsForm from "../src/routes/settings-form.svelte";
import { settingsSchema } from "../src/routes/schema.js";
import CustomDescriptionField from "./fixtures/custom-description-field.svelte";
import ElementInheritance from "./fixtures/element-inheritance.svelte";
import LifecycleField from "./fixtures/lifecycle-field.svelte";
import AssociationOwners from "./fixtures/association-owners.svelte";
import AssociationRendering from "./fixtures/association-rendering.svelte";
import ControlOwners from "./fixtures/control-owners.svelte";
import { urlsSchema } from "./fixtures/urls-schema.js";
import { danglingReferences, duplicateIds } from "./html.js";

let mounted: Parameters<typeof unmount>[0] | undefined;

afterEach(async () => {
	if (mounted) await unmount(mounted);
	mounted = undefined;
	document.body.innerHTML = "";
});

/**
 * `superValidate` needs an adapter carrying a JSON schema, which is what the `zod` adapter
 * provides; `zodClient` only validates. The fixtures therefore build their data the way the
 * documented server-side `superValidate` call does.
 */
async function dataFor(email: string) {
	return superValidate({ email, bio: "hello" }, zod(settingsSchema));
}

function clickButton(text: string) {
	const button = [...document.querySelectorAll("button")].find((element) =>
		element.textContent?.includes(text)
	);
	expect(button, `button "${text}"`).toBeDefined();
	button?.click();
	flushSync();
}

/** The ids a control currently points at through `aria-describedby`. */
function describedBy(control: Element | null) {
	return (control?.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
}

function controlFor(field: string) {
	return document.querySelector(`[name="${field}"]`);
}

/** The id of the rendered description whose text contains `text`. */
function descriptionId(text: string) {
	const description = [...document.querySelectorAll("[data-fs-description]")].find((element) =>
		element.textContent?.includes(text)
	);
	expect(description, `description containing "${text}"`).toBeDefined();
	return description?.getAttribute("id") ?? "";
}

describe("the rendered fixture", () => {
	it("renders submitted values and keeps labels associated with their controls", async () => {
		mounted = mount(SettingsForm, {
			target: document.body,
			props: { validated: await dataFor("a@b.com") },
		});
		flushSync();

		const email = document.querySelector<HTMLInputElement>('[name="email"]');
		expect(email?.value).toBe("a@b.com");
		expect(document.querySelector<HTMLTextAreaElement>('[name="bio"]')?.value).toBe("hello");

		const label = [...document.querySelectorAll("label")].find(
			(element) => element.textContent?.trim() === "Email"
		);
		expect(label?.getAttribute("for")).toBe(email?.getAttribute("id"));
		expect(danglingReferences(document)).toEqual([]);
		expect(duplicateIds(document)).toEqual([]);
	});
});

describe("description ownership", () => {
	it("references every rendered description, in the order they were rendered", async () => {
		mounted = mount(LifecycleField, {
			target: document.body,
			props: { validated: await dataFor("a@b.com") },
		});
		flushSync();

		expect(describedBy(controlFor("email"))).toEqual([
			descriptionId("We'll email you about your account."),
			"email-second-help",
		]);
	});

	it("withdraws only the description that unmounted", async () => {
		mounted = mount(LifecycleField, {
			target: document.body,
			props: { validated: await dataFor("a@b.com") },
		});
		flushSync();

		clickButton("toggle description");
		expect(describedBy(controlFor("email"))).toEqual(["email-second-help"]);

		clickButton("toggle second description");
		expect(describedBy(controlFor("email"))).toEqual([]);

		clickButton("toggle description");
		expect(describedBy(controlFor("email"))).toEqual([
			descriptionId("We'll email you about your account."),
		]);
		expect(danglingReferences(document)).toEqual([]);
	});

	it("keeps one field's descriptions out of another field", async () => {
		mounted = mount(LifecycleField, {
			target: document.body,
			props: { validated: await dataFor("a@b.com") },
		});
		flushSync();

		const bioDescriptionId = descriptionId("Tell us about yourself.");
		expect(describedBy(controlFor("bio"))).toEqual([bioDescriptionId]);
		expect(describedBy(controlFor("email"))).not.toContain(bioDescriptionId);
	});
});

describe("error container ownership", () => {
	it("stops referencing the error container once it unmounts, while the errors stay", async () => {
		mounted = mount(LifecycleField, {
			target: document.body,
			props: { validated: await dataFor("not-an-email") },
		});
		flushSync();

		const control = controlFor("email");
		expect(control?.getAttribute("aria-invalid")).toBe("true");

		const renderedContainers = [...document.querySelectorAll("[data-fs-field-errors]")].map(
			(container) => container.getAttribute("id") ?? ""
		);
		const referenced = describedBy(control).find((id) => renderedContainers.includes(id));
		expect(referenced, "the control references a rendered error container").toBeDefined();

		clickButton("toggle errors");

		expect(control?.getAttribute("aria-invalid"), "the field still has errors").toBe("true");
		expect(describedBy(control)).not.toContain(referenced);
		expect(danglingReferences(document)).toEqual([]);
	});
});

describe("association integrity through every transition", () => {
	it("never references a missing element or repeats an id", async () => {
		mounted = mount(LifecycleField, {
			target: document.body,
			props: { validated: await dataFor("not-an-email") },
		});
		flushSync();

		const buttons = [
			"toggle description",
			"toggle second description",
			"toggle errors",
			"toggle description",
			"toggle errors",
			"toggle second description",
		];
		for (const button of buttons) {
			clickButton(button);
			expect(danglingReferences(document), `after "${button}"`).toEqual([]);
			expect(duplicateIds(document), `after "${button}"`).toEqual([]);
		}
	});
});

describe("element fields", () => {
	async function mountElementField() {
		const data = await superValidate(
			{ urls: ["https://example.com", "https://example.org"] },
			zod(urlsSchema)
		);
		mounted = mount(ElementInheritance, { target: document.body, props: { validated: data } });
		flushSync();
		return controlFor("urls");
	}

	it("submits every array element under the field's own name", async () => {
		await mountElementField();

		const inputs = [...document.querySelectorAll('input[name="urls"]')];
		expect(inputs, "one control per element").toHaveLength(2);
		expect(new Set(inputs.map((input) => input.getAttribute("id"))).size, "distinct ids").toBe(
			2
		);
	});

	it("inherits the field description until the element renders one of its own", async () => {
		const control = await mountElementField();
		expect(describedBy(control)).toEqual(["urls-help"]);

		clickButton("toggle local description");
		expect(describedBy(control)).toEqual(["urls-0-help"]);
	});

	it("restores the field description when the element's own description goes away", async () => {
		const control = await mountElementField();

		clickButton("toggle local description");
		clickButton("toggle group description");
		expect(describedBy(control)).toEqual(["urls-0-help"]);

		clickButton("toggle local description");
		expect(describedBy(control)).toEqual([]);

		clickButton("toggle group description");
		expect(describedBy(control)).toEqual(["urls-help"]);
		expect(danglingReferences(document)).toEqual([]);
	});

	it("restores inherited descriptions after a local headless contributor unmounts", async () => {
		const control = await mountElementField();
		clickButton("toggle headless description");
		expect(describedBy(control)).toEqual(["urls-0-headless-help"]);
		expect(describedBy(document.querySelectorAll('[name="urls"]')[1])).toEqual(["urls-help"]);

		clickButton("toggle headless description");
		expect(describedBy(control)).toEqual(["urls-help"]);
		expect(danglingReferences(document)).toEqual([]);
	});
});

describe("headless consumer overrides", () => {
	it("releases the description id when the getter returns null", async () => {
		mounted = mount(CustomDescriptionField, {
			target: document.body,
			props: { validated: await dataFor("a@b.com") },
		});
		flushSync();

		expect(describedBy(controlFor("email"))).toEqual([]);

		clickButton("toggle custom help");
		expect(describedBy(controlFor("email"))).toEqual(["custom-help"]);

		clickButton("toggle custom help");
		expect(describedBy(controlFor("email"))).toEqual([]);
		expect(danglingReferences(document)).toEqual([]);
	});
});

describe("shared and headless association owners", () => {
	async function mountOwners() {
		mounted = mount(AssociationOwners, {
			target: document.body,
			props: { validated: await dataFor("not-an-email") },
		});
		flushSync();
		return controlFor("email");
	}

	it("registers initially non-null getters and deduplicates shared targets", async () => {
		const control = await mountOwners();
		const ids = describedBy(control);
		expect(ids).toHaveLength(4);
		expect(new Set(ids)).toEqual(
			new Set(["shared-help", "unique-help", "shared-errors", "unique-errors"])
		);
		for (const owner of document.querySelectorAll("[data-owner]")) {
			expect(owner.getAttribute("data-description")).toBe(ids[0]);
			expect(owner.getAttribute("data-errors")).toBe(
				ids.find((id) => id.endsWith("-errors"))
			);
		}
		expect(danglingReferences(document)).toEqual([]);
	});

	it("keeps component contributions when another owner returns null or unmounts", async () => {
		const control = await mountOwners();
		clickButton("release shared owner");
		expect(describedBy(control)).toContain("shared-help");
		expect(describedBy(control)).toContain("shared-errors");

		clickButton("release shared owner");
		clickButton("toggle shared owner");
		expect(describedBy(control)).toContain("shared-help");
		expect(describedBy(control)).toContain("shared-errors");
		expect(new Set(describedBy(control)).size).toBe(describedBy(control).length);
	});

	it("keeps a hook contribution when the component owner is replaced", async () => {
		const control = await mountOwners();
		clickButton("toggle contributing components");
		expect(describedBy(control)).toContain("shared-help");
		expect(describedBy(control)).toContain("shared-errors");

		clickButton("toggle shared owner");
		expect(describedBy(control)).not.toContain("shared-help");
		expect(describedBy(control)).not.toContain("shared-errors");
		expect(describedBy(control)).toEqual(["unique-help", "unique-errors"]);
	});

	it("withdraws only an unmounted hook's unique contributions and restores them on remount", async () => {
		const control = await mountOwners();
		clickButton("toggle unique owner");
		expect(describedBy(control)).toEqual(["shared-help", "shared-errors"]);

		clickButton("toggle unique owner");
		expect(describedBy(control)).toContain("unique-help");
		expect(describedBy(control)).toContain("unique-errors");
		expect(danglingReferences(document)).toEqual([]);
	});

	it("deduplicates an element serving as both a description and an error target", async () => {
		const control = await mountOwners();
		clickButton("combine unique associations");
		expect(describedBy(control).filter((id) => id === "unique-help")).toHaveLength(1);
		expect(new Set(describedBy(control))).toEqual(
			new Set(["shared-help", "unique-help", "shared-errors"])
		);
	});

	it("moves a hook contribution to its updated target without dropping other owners", async () => {
		const control = await mountOwners();
		clickButton("rename unique hook help");
		expect(describedBy(control)).toContain("renamed-unique-help");
		expect(describedBy(control)).not.toContain("unique-help");
		expect(describedBy(control)).toContain("shared-help");
		expect(describedBy(control)).toContain("shared-errors");
		expect(describedBy(control)).toContain("unique-errors");
		expect(danglingReferences(document)).toEqual([]);
	});
});

describe("associations belong to the actual spread-props node", () => {
	async function mountRendering() {
		const fixture = mount(AssociationRendering, {
			target: document.body,
			props: { validated: await dataFor("not-an-email") },
		});
		mounted = fixture;
		flushSync();
		return { control: controlFor("email"), references: fixture.references };
	}

	it("does not claim a document id when a custom child forgot to spread the props", async () => {
		const { control } = await mountRendering();
		expect(describedBy(control)).toEqual([
			"moving-help",
			"custom-help",
			"moving-errors",
			"remaining-errors",
		]);
		const refs = document.querySelector("[data-rendered-refs]");
		expect(refs?.getAttribute("data-omitted-description-ref")).toBe("none");
		expect(refs?.getAttribute("data-omitted-errors-ref")).toBe("none");
		expect(duplicateIds(document)).toEqual([]);
	});

	it("re-associates dynamic ids while retaining the same actual node and ref", async () => {
		const { control, references } = await mountRendering();
		const description = document.getElementById("moving-help");
		const errors = document.getElementById("moving-errors");
		clickButton("rename help");
		clickButton("rename errors");

		expect(document.getElementById("renamed-help")).toBe(description);
		expect(document.getElementById("renamed-errors")).toBe(errors);
		expect(describedBy(control)).toContain("renamed-help");
		expect(describedBy(control)).toContain("renamed-errors");
		expect(describedBy(control)).not.toContain("moving-help");
		expect(describedBy(control)).not.toContain("moving-errors");
		expect(references().description).toBe(description);
		expect(references().errors).toBe(errors);
		expect(references().description?.id).toBe("renamed-help");
		expect(references().errors?.id).toBe("renamed-errors");
		expect(danglingReferences(document)).toEqual([]);
	});

	it("clears a default component's ref and only its own contribution on destroy", async () => {
		const { control, references } = await mountRendering();
		expect(references().description).toBe(document.getElementById("moving-help"));
		clickButton("toggle default description");
		expect(references().description).toBeNull();
		expect(describedBy(control)).not.toContain("moving-help");
		expect(describedBy(control)).toContain("custom-help");
		expect(describedBy(control)).toContain("moving-errors");

		clickButton("toggle default description");
		expect(references().description).toBe(document.getElementById("moving-help"));
		expect(describedBy(control)).toContain("moving-help");
		expect(danglingReferences(document)).toEqual([]);
	});

	it("withdraws custom child nodes without destroying their components or other error containers", async () => {
		const { control } = await mountRendering();
		clickButton("toggle custom description child");
		clickButton("toggle custom errors child");
		expect(describedBy(control)).toEqual(["moving-help", "remaining-errors"]);
		expect(
			document.querySelector("[data-rendered-refs]")?.getAttribute("data-errors-ref")
		).toBe("none");
		expect(control?.getAttribute("aria-invalid")).toBe("true");

		clickButton("toggle default errors");
		expect(describedBy(control)).toEqual(["moving-help"]);
		clickButton("toggle custom errors child");
		expect(describedBy(control)).toEqual(["moving-help", "moving-errors"]);
		expect(danglingReferences(document)).toEqual([]);
	});
});

describe("headless control identity ownership", () => {
	async function mountControls() {
		mounted = mount(ControlOwners, {
			target: document.body,
			props: { validated: await dataFor("a@b.com") },
		});
		flushSync();
	}

	function expectControlId(id: string) {
		expect(controlFor("email")?.getAttribute("id")).toBe(id);
		expect(document.querySelector("label")?.getAttribute("for")).toBe(id);
		for (const owner of document.querySelectorAll("[data-control-owner]")) {
			expect(owner.getAttribute("data-id")).toBe(id);
			expect(owner.getAttribute("data-props-id")).toBe(id);
			expect(owner.getAttribute("data-label-for")).toBe(id);
		}
		expect(danglingReferences(document)).toEqual([]);
	}

	it("applies initial hook ids and exposes consistent control and label props", async () => {
		await mountControls();
		expectControlId("second-email");
	});

	it("releases null and destroyed owners without erasing another owner's id", async () => {
		await mountControls();
		clickButton("release second control id");
		expectControlId("first-email");
		clickButton("change first control id");
		expectControlId("changed-first-email");

		clickButton("release second control id");
		expectControlId("second-email");
		clickButton("toggle first control owner");
		expectControlId("second-email");
		clickButton("toggle second control owner");
		expectControlId("component-email");
		clickButton("change component control id");
		expectControlId("changed-component-email");
	});

	it("restores a surviving hook owner after the winning hook unmounts", async () => {
		await mountControls();
		clickButton("toggle second control owner");
		expectControlId("first-email");
		clickButton("toggle second control owner");
		expectControlId("second-email");
	});
});
