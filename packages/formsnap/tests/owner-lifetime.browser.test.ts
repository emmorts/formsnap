import { afterEach, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import OwnerLifetime from "./fixtures/owner-lifetime.svelte";
import { reactivityData, reactivitySchema } from "./fixtures/reactivity-schema.js";

let mounted: Parameters<typeof unmount>[0] | undefined;

afterEach(async () => {
	if (mounted) await unmount(mounted);
	mounted = undefined;
	document.body.innerHTML = "";
});

function hook(view: string) {
	return document.querySelector<HTMLOutputElement>(`[data-hook="${view}"]`)!;
}

function value(view: string) {
	return document.querySelector<HTMLOutputElement>(`[data-value="${view}"]`)!;
}

function controls() {
	return [...document.querySelectorAll<HTMLInputElement>("[data-control]")];
}

function expectTargets() {
	for (const control of controls()) {
		const ids = control.getAttribute("aria-describedby")!.split(/\s+/);
		for (const id of ids) expect(document.getElementById(id)).not.toBeNull();
		const label = document.querySelector<HTMLLabelElement>(`label[for="${control.id}"]`);
		expect(label).not.toBeNull();
	}
}

it("keys the entire field subtree when replacing its form owner, including nested scopes and hooks", async () => {
	const first = await superValidate(reactivityData, zod(reactivitySchema));
	const second = await superValidate(
		{ profile: { name: "Grace", sibling: "second" }, rows: [{ name: "second owner row" }] },
		zod(reactivitySchema)
	);
	const consumer = mount(OwnerLifetime, { target: document.body, props: { first, second } });
	mounted = consumer;
	const owners = consumer.owners();
	owners.first.errors.set({ profile: { name: ["first owner error"] } }, { force: true });
	owners.first.tainted.set({ profile: { name: true } });
	owners.second.errors.update(
		(root) => {
			root.rows = { 0: { name: ["second row error"] } };
			root.rows._errors = ["second group error"];
			return root;
		},
		{ force: true }
	);
	owners.second.tainted.set({ rows: { 0: { name: true } } });
	owners.second.constraints.update((root) => {
		root.profile!.name!.required = false;
		root.rows!.name!.required = false;
		return root;
	});
	flushSync();

	expect(value("field").textContent).toBe("Ada");
	expect(hook("field").getAttribute("data-errors")).toBe('["first owner error"]');
	expect(hook("field").getAttribute("data-tainted")).toBe("true");
	expectTargets();
	const oldControls = controls();
	const oldIds = [
		...document.querySelectorAll<HTMLElement>(
			"[data-fs-control], [data-fs-label], [data-fs-description], [data-fs-field-errors]"
		),
	].map((node) => node.id);

	consumer.select("second");
	flushSync();
	expect(value("field").textContent).toBe("Grace");
	expect(value("element").textContent).toBe("second owner row");
	for (const view of ["field", "fieldset", "element"]) {
		expect(hook(view).getAttribute("data-owner-value")).toBe("Grace");
	}
	expect(hook("field").getAttribute("data-errors")).toBe("[]");
	expect(hook("field").getAttribute("data-tainted")).toBe("false");
	expect(hook("fieldset").getAttribute("data-errors")).toBe('["second group error"]');
	expect(hook("element").getAttribute("data-errors")).toBe('["second row error"]');
	expect(hook("element").getAttribute("data-tainted")).toBe("true");
	for (const view of ["field", "element"]) {
		expect(value(view).getAttribute("data-required")).toBe("false");
	}
	for (const control of oldControls) expect(control.isConnected).toBe(false);
	for (const id of oldIds) expect(document.getElementById(id)).toBeNull();
	expectTargets();

	owners.first.form.update((root) => {
		root.profile.name = "Updated first owner";
		return root;
	});
	owners.first.errors.set({ profile: { name: ["later first error"] } }, { force: true });
	flushSync();
	expect(value("field").textContent).toBe("Grace");
	expect(hook("field").getAttribute("data-errors")).toBe("[]");

	consumer.select("first");
	flushSync();
	expect(value("field").textContent).toBe("Updated first owner");
	expect(value("element").textContent).toBe("first row");
	expect(hook("field").getAttribute("data-errors")).toBe('["later first error"]');
	for (const view of ["field", "fieldset", "element"]) {
		expect(hook(view).getAttribute("data-owner-value")).toBe("Updated first owner");
	}
	expectTargets();
});
