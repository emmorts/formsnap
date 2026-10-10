import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import SettingsForm from "../src/routes/settings-form.svelte";
import { settingsSchema } from "../src/routes/schema.js";
import CustomDescriptionField from "./fixtures/custom-description-field.svelte";
import ElementInheritance from "./fixtures/element-inheritance.svelte";
import LifecycleField from "./fixtures/lifecycle-field.svelte";
import { urlsSchema } from "./fixtures/urls-schema.js";
import { danglingReferences, duplicateIds } from "./html.js";

let mounted: Parameters<typeof unmount>[0] | undefined;

afterEach(() => {
	if (mounted) unmount(mounted);
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
