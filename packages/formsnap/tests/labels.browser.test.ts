import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import LabelIdentity from "../src/routes/label-identity/label-identity.svelte";
import { reactivityData, reactivitySchema } from "./fixtures/reactivity-schema.js";
import { danglingReferences, duplicateIds } from "./html.js";

let mounted: Parameters<typeof unmount>[0] | undefined;

afterEach(async () => {
	if (mounted) await unmount(mounted);
	mounted = undefined;
	document.body.innerHTML = "";
});

async function mountConsumer(headless = false) {
	const validated = await superValidate(reactivityData, zod(reactivitySchema));
	const consumer = mount(LabelIdentity, {
		target: document.body,
		props: { validated, headless },
	});
	mounted = consumer;
	flushSync();
	return consumer;
}

function click(text: string) {
	const button = [...document.querySelectorAll("button")].find(
		(element) => element.textContent?.trim() === text
	);
	expect(button, text).toBeDefined();
	button!.click();
	flushSync();
}

function expectSelected(id: string) {
	const widget = document.querySelector("[data-widget]");
	expect(widget?.getAttribute("aria-labelledby")).toBe(id);
	expect(
		document.querySelector("[data-selected-label]")?.getAttribute("data-selected-label")
	).toBe(id);
	expect(document.getElementById(id), "selected label exists").not.toBeNull();
	expect(danglingReferences(document)).toEqual([]);
	expect(duplicateIds(document)).toEqual([]);
}

describe("label-local identity and owner-scoped naming", () => {
	it("keeps multiple native Labels unique and associates both with the same input", async () => {
		const consumer = await mountConsumer();
		const input = document.querySelector<HTMLInputElement>("[data-native-control]");
		const first = document.getElementById("first-label");
		const second = document.getElementById("second-label");
		expect(first?.tagName).toBe("LABEL");
		expect(second?.tagName).toBe("LABEL");
		expect(first?.getAttribute("for")).toBe(input?.id);
		expect(second?.getAttribute("for")).toBe(input?.id);
		expect(input?.labels).toHaveLength(2);
		expect(consumer.refs()).toEqual({ first, second, child: null });
		expect(duplicateIds(document)).toEqual([]);
		expect(danglingReferences(document)).toEqual([]);

		consumer.stores().errors.set({ profile: { name: ["Required name"] } }, { force: true });
		flushSync();
		for (const label of [first, second]) expect(label?.getAttribute("data-fs-error")).toBe("");
		click("Change control id");
		for (const label of [first, second]) {
			expect(label?.getAttribute("for")).toBe("changed-identity-control");
		}
		click("Change first label id");
		expect(first?.id).toBe("changed-first-label");
		expect(second?.id).toBe("second-label");
		expect(consumer.refs().first).toBe(first);
	});

	it("preserves naming precedence when a surviving label's attributes change", async () => {
		const consumer = await mountConsumer(true);
		const first = document.getElementById("first-label");
		expectSelected("second-label");
		click("Change first label id");
		expect(first?.id).toBe("changed-first-label");
		expect(consumer.refs().first).toBe(first);
		expectSelected("second-label");

		click("Change control id");
		expectSelected("second-label");
		consumer.stores().errors.set({ profile: { name: ["Required name"] } }, { force: true });
		flushSync();
		expectSelected("second-label");

		click("Change second label id");
		expectSelected("changed-second-label");
		click("Toggle second label");
		expectSelected("changed-first-label");
	});

	it("tracks the latest active label ID and restores surviving/default naming on teardown", async () => {
		const consumer = await mountConsumer(true);
		expectSelected("second-label");
		click("Change second label id");
		expectSelected("changed-second-label");
		expect(consumer.refs().second).toBe(document.getElementById("changed-second-label"));
		click("Toggle second label");
		expectSelected("first-label");
		expect(consumer.refs().second).toBeNull();
		click("Change first label id");
		expectSelected("changed-first-label");
		click("Toggle first label");
		const fallback = document.querySelector("[data-fallback-label]");
		expect(fallback).not.toBeNull();
		expectSelected(fallback!.id);
		expect(consumer.refs()).toEqual({ first: null, second: null, child: null });
		click("Toggle first label");
		expectSelected("changed-first-label");
		click("Toggle second label");
		expectSelected("changed-second-label");
		// Removing a non-selected owner must not change the active naming identity.
		click("Toggle first label");
		expectSelected("changed-second-label");
	});

	it("only resolves custom-child refs and mounted naming when label props reach a local node", async () => {
		const consumer = await mountConsumer(true);
		// An unrelated same-id element must not satisfy a no-spread label's ref.
		const unrelated = document.createElement("span");
		unrelated.id = "child-label";
		document.body.append(unrelated);
		click("Toggle child spread");
		click("Toggle child label");
		expect(consumer.refs().child).toBeNull();
		expectSelected("second-label");
		unrelated.remove();

		click("Toggle child spread");
		expectSelected("child-label");
		expect(consumer.refs().child).toBe(document.querySelector("[data-custom-label]"));
		click("Toggle child spread");
		expectSelected("second-label");
		expect(consumer.refs().child).toBeNull();
		expect(document.getElementById("child-label")).toBeNull();
		click("Toggle child spread");
		expectSelected("child-label");
		click("Toggle child label");
		expectSelected("second-label");
		expect(consumer.refs().child).toBeNull();
	});
});
