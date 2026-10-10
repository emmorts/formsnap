import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import NativeControls from "./fixtures/native-controls.svelte";
import { nativeSchema } from "./fixtures/native-schema.js";
import { danglingReferences, duplicateIds } from "./html.js";

let mounted: Parameters<typeof unmount>[0] | undefined;

afterEach(async () => {
	if (mounted) await unmount(mounted);
	mounted = undefined;
	document.body.innerHTML = "";
});

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
