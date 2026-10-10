import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import ArrayRows from "./fixtures/array-rows.svelte";
import NativeControls from "./fixtures/native-controls.svelte";
import { nativeSchema } from "./fixtures/native-schema.js";
import { urlsSchema } from "./fixtures/urls-schema.js";
import { danglingReferences, duplicateIds } from "./html.js";

let mounted: Parameters<typeof unmount>[0] | undefined;

afterEach(() => {
	if (mounted) unmount(mounted);
	mounted = undefined;
	document.body.innerHTML = "";
});

function clickButton(text: string) {
	const button = [...document.querySelectorAll("button")].find((element) =>
		element.textContent?.includes(text)
	);
	expect(button, `button "${text}"`).toBeDefined();
	button?.click();
	flushSync();
}

/** The value each rendered array row received. */
function rows() {
	return [...document.querySelectorAll("output[data-row]")].map((output) => ({
		row: output.getAttribute("data-row"),
		value: output.getAttribute("data-value"),
	}));
}

async function mountNativeControls() {
	const validated = await superValidate({ marketing: true, theme: "dark" }, zod(nativeSchema));
	mounted = mount(NativeControls, { target: document.body, props: { validated } });
	flushSync();
}

describe("native controls", () => {
	it("associates a checkbox with the label that follows it", async () => {
		await mountNativeControls();

		const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
		expect(checkbox?.checked, "the submitted value drives the control").toBe(true);

		const label = [...document.querySelectorAll("label")].find((element) =>
			element.textContent?.includes("marketing emails")
		);
		expect(label?.getAttribute("for")).toBe(checkbox?.getAttribute("id"));
		expect(danglingReferences(document)).toEqual([]);
		expect(duplicateIds(document)).toEqual([]);
	});

	it("groups radios inside the fieldset its legend names", async () => {
		await mountNativeControls();

		const fieldset = document.querySelector("fieldset");
		expect(fieldset, "a fieldset is rendered").not.toBeNull();
		expect(fieldset?.querySelector("legend")?.textContent?.trim()).toBe("Select your theme");

		const radios = [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
		expect(radios, "one control per option").toHaveLength(2);
		for (const radio of radios) {
			expect(fieldset?.contains(radio), `${radio.value} is grouped`).toBe(true);
			const label = [...document.querySelectorAll("label")].find(
				(element) => element.getAttribute("for") === radio.getAttribute("id")
			);
			expect(label, `label for ${radio.value}`).toBeDefined();
		}
		expect(radios.find((radio) => radio.checked)?.value, "the selected option").toBe("dark");
		expect(danglingReferences(document)).toEqual([]);
		expect(duplicateIds(document)).toEqual([]);
	});
});

describe("array rows", () => {
	async function mountRows() {
		const validated = await superValidate(
			{ urls: ["https://a.example", "https://b.example"] },
			zod(urlsSchema)
		);
		mounted = mount(ArrayRows, { target: document.body, props: { validated } });
		flushSync();
	}

	it("keeps every row attached to its own value as rows are added, reordered and removed", async () => {
		await mountRows();
		expect(rows()).toEqual([
			{ row: "0", value: '"https://a.example"' },
			{ row: "1", value: '"https://b.example"' },
		]);

		clickButton("add row");
		expect(rows()).toEqual([
			{ row: "0", value: '"https://a.example"' },
			{ row: "1", value: '"https://b.example"' },
			{ row: "2", value: '"https://added.example"' },
		]);

		clickButton("reorder rows");
		expect(rows()).toEqual([
			{ row: "0", value: '"https://added.example"' },
			{ row: "1", value: '"https://b.example"' },
			{ row: "2", value: '"https://a.example"' },
		]);

		clickButton("remove row");
		expect(rows()).toEqual([
			{ row: "0", value: '"https://added.example"' },
			{ row: "1", value: '"https://b.example"' },
		]);
		expect(danglingReferences(document)).toEqual([]);
		expect(duplicateIds(document)).toEqual([]);
	});
});

describe("the assertion helpers", () => {
	it("report a reference that names no element", () => {
		document.body.innerHTML = `<label for="missing">Label</label><input id="present" aria-describedby="also-missing" />`;

		const found = danglingReferences(document);

		expect(found.some((message) => message.includes('"missing"'))).toBe(true);
		expect(found.some((message) => message.includes('"also-missing"'))).toBe(true);
	});

	it("report a repeated id", () => {
		document.body.innerHTML = `<div id="same"></div><div id="same"></div>`;

		expect(duplicateIds(document)).toEqual(['"same" appears 2 times']);
	});
});
