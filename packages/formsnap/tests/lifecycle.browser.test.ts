import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import SettingsForm from "../src/routes/settings-form.svelte";
import { settingsSchema } from "../src/routes/schema.js";
import ToggleField from "./fixtures/toggle-field.svelte";
import { danglingReferences, duplicateIds } from "./html.js";

let mounted: Parameters<typeof unmount>[0] | undefined;

afterEach(() => {
	if (mounted) unmount(mounted);
	mounted = undefined;
	document.body.innerHTML = "";
});

/**
 * `superValidate` needs an adapter carrying a JSON schema, which is what the `zod` adapter
 * provides; `zodClient` only validates. The fixture therefore builds its initial data exactly the
 * way the documented server-side `superValidate` call does.
 */
async function validFormData() {
	return superValidate({ email: "a@b.com", bio: "hello" }, zod(settingsSchema));
}

function clickButton(text: string) {
	const button = [...document.querySelectorAll("button")].find((element) =>
		element.textContent?.includes(text)
	);
	expect(button, `button "${text}"`).toBeDefined();
	button?.click();
	flushSync();
}

describe("consumer fixture in a browser", () => {
	it("renders submitted values and keeps labels associated with their controls", async () => {
		mounted = mount(SettingsForm, {
			target: document.body,
			props: { validated: await validFormData() },
		});
		flushSync();

		const email = document.querySelector<HTMLInputElement>('[name="email"]');
		const bio = document.querySelector<HTMLTextAreaElement>('[name="bio"]');
		expect(email?.value).toBe("a@b.com");
		expect(bio?.value).toBe("hello");

		const label = [...document.querySelectorAll("label")].find(
			(element) => element.textContent?.trim() === "Email"
		);
		expect(label?.getAttribute("for")).toBe(email?.getAttribute("id"));
		expect(danglingReferences(document)).toEqual([]);
		expect(duplicateIds(document)).toEqual([]);
	});

	it("keeps ids unique and references resolvable while the error container mounts and unmounts", async () => {
		mounted = mount(ToggleField, {
			target: document.body,
			props: { validated: await validFormData() },
		});
		flushSync();

		for (const round of [1, 2]) {
			clickButton("toggle errors");

			expect(danglingReferences(document), `after toggle ${round}`).toEqual([]);
			expect(duplicateIds(document), `after toggle ${round}`).toEqual([]);
			expect(document.querySelectorAll("label"), `labels after toggle ${round}`).toHaveLength(
				1
			);
		}
	});

	it.fails("stops referencing the description once the description unmounts", async () => {
		mounted = mount(ToggleField, {
			target: document.body,
			props: { validated: await validFormData() },
		});
		flushSync();

		clickButton("toggle description");

		expect(danglingReferences(document)).toEqual([]);
	});
});
