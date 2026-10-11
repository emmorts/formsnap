import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { get } from "svelte/store";
import {
	superValidate,
	type SuperForm,
	type TaintedFields,
	type ValidationErrors,
} from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import Reactivity from "./fixtures/reactivity.svelte";
import {
	reactivityData,
	reactivitySchema,
	type ReactivityData,
} from "./fixtures/reactivity-schema.js";

let mounted: Parameters<typeof unmount>[0] | undefined;

afterEach(async () => {
	if (mounted) await unmount(mounted);
	mounted = undefined;
	document.body.innerHTML = "";
});

async function mountConsumer() {
	const validated = await superValidate(reactivityData, zod(reactivitySchema));
	const consumer = mount(Reactivity, { target: document.body, props: { validated } });
	mounted = consumer;
	const form = consumer.stores();
	form.errors.set(
		{
			profile: {
				_errors: ["group initial"],
				name: ["nested initial"],
				sibling: ["sibling initial"],
			},
			rows: { 0: { name: ["row initial"] }, 1: { name: ["second row"] } },
		},
		{ force: true }
	);
	form.tainted.set({
		profile: { name: true, sibling: true },
		rows: { 0: { name: true }, 1: { name: false } },
	});
	form.constraints.update((root) => {
		root.profile!.sibling!.required = false;
		return root;
	});
	flushSync();
	return { form, consumer };
}

function received(id: string) {
	const output = document.querySelector<HTMLOutputElement>(`output[data-view="${id}"]`);
	const control = document.querySelector<HTMLInputElement>(`input[data-control="${id}"]`);
	expect(output, `snippet output for ${id}`).not.toBeNull();
	expect(control, `rendered control for ${id}`).not.toBeNull();
	return {
		errors: JSON.parse(output!.getAttribute("data-errors")!) as string[],
		tainted: output!.getAttribute("data-tainted"),
		constraints: JSON.parse(output!.getAttribute("data-constraints")!) as Record<
			string,
			unknown
		>,
		invalid: control!.getAttribute("aria-invalid"),
		required: control!.getAttribute("aria-required"),
	};
}

function expectView(id: string, errors: string[], tainted: boolean, required: boolean | undefined) {
	const state = received(id);
	expect(state.errors).toEqual(errors);
	expect(state.tainted).toBe(String(tainted));
	expect(state.invalid).toBe(errors.length ? "true" : null);
	expect(state.required).toBe(required ? "true" : null);
	return state;
}

function updateErrors(
	form: SuperForm<ReactivityData>,
	mutate: (root: ValidationErrors<ReactivityData>) => void
) {
	const original = get(form.errors);
	form.errors.update(
		(root) => {
			expect(root).toBe(original);
			mutate(root);
			return root;
		},
		{ force: true }
	);
	expect(get(form.errors)).toBe(original);
}

describe("consumer-visible same-object store updates", () => {
	it("updates nested and array Field/ElementField snippets and controls without changing a sibling", async () => {
		const { form } = await mountConsumer();
		expectView("nested", ["nested initial"], true, true);
		for (const id of ["array", "element"]) expectView(id, ["row initial"], true, true);
		const sibling = received("sibling");

		updateErrors(form, (root) => {
			root.profile!.name!.push("nested later");
			root.rows![0].name!.push("row later");
		});
		const constraints = get(form.constraints);
		form.constraints.update((root) => {
			expect(root).toBe(constraints);
			root.profile!.name!.required = false;
			root.profile!.name!.minlength = 12;
			root.rows!.name!.required = false;
			root.rows!.name!.minlength = 15;
			return root;
		});
		expect(get(form.constraints)).toBe(constraints);
		const tainted = get(form.tainted);
		form.tainted.update((root) => {
			expect(root).toBe(tainted);
			root!.profile!.name = false;
			root!.rows![0].name = false;
			return root;
		});
		expect(get(form.tainted)).toBe(tainted);
		flushSync();

		expect(
			expectView("nested", ["nested initial", "nested later"], false, false).constraints
		).toMatchObject({ minlength: 12, required: false });
		for (const id of ["array", "element"]) {
			expect(
				expectView(id, ["row initial", "row later"], false, false).constraints
			).toMatchObject({ minlength: 15, required: false });
		}
		expect(received("sibling")).toEqual(sibling);

		updateErrors(form, (root) => {
			root.profile!.name = [];
			root.rows![0].name = [];
		});
		form.constraints.update((root) => {
			delete root.profile!.name;
			delete root.rows!.name;
			return root;
		});
		form.tainted.update((root) => {
			delete root!.profile!.name;
			delete root!.rows![0].name;
			return root;
		});
		flushSync();
		for (const id of ["nested", "array", "element"]) {
			expect(expectView(id, [], false, undefined).constraints).toEqual({});
		}
		expect(received("sibling")).toEqual(sibling);

		updateErrors(form, (root) => {
			delete root.profile!.name;
			delete root.rows![0].name;
		});
		form.tainted.set(undefined);
		flushSync();
		for (const id of ["nested", "array", "element"]) expectView(id, [], false, undefined);
		expect(received("sibling")).toEqual({ ...sibling, tainted: "false" });
	});

	it("follows switched nested and array paths and ignores subsequent updates to the old paths", async () => {
		const { form, consumer } = await mountConsumer();
		consumer.switchPaths();
		flushSync();
		expect(expectView("nested", ["sibling initial"], true, false).constraints).toMatchObject({
			minlength: 3,
			required: false,
		});
		for (const id of ["array", "element"]) {
			expect(expectView(id, ["second row"], false, true).constraints).toMatchObject({
				minlength: 4,
				required: true,
			});
		}
		const active = ["nested", "array", "element", "sibling"].map(received);
		updateErrors(form, (root) => {
			delete root.profile!.name;
			delete root.rows![0].name;
		});
		form.tainted.update((root) => {
			root!.profile!.name = false;
			root!.rows![0].name = false;
			return root;
		});
		form.constraints.update((root) => {
			root.profile!.name!.minlength = 10;
			return root;
		});
		flushSync();
		expect(["nested", "array", "element", "sibling"].map(received)).toEqual(active);

		consumer.switchPaths();
		flushSync();
		expect(expectView("nested", [], false, true).constraints).toMatchObject({ minlength: 10 });
		for (const id of ["array", "element"]) expectView(id, [], false, true);
	});
});

describe("selected subtree taint", () => {
	it("counts true descendants, not sibling taint, through same-root updates and clearing", async () => {
		const { form } = await mountConsumer();
		expect(received("group").tainted).toBe("true");
		expect(received("array-group").tainted).toBe("true");
		expect(received("selected-group").tainted).toBe("true");
		expect(received("element-group").tainted).toBe("true");
		const root = get(form.tainted);

		form.tainted.update((tainted) => {
			expect(tainted).toBe(root);
			tainted!.profile!.name = false;
			tainted!.profile!.sibling = false;
			return tainted;
		});
		flushSync();
		expect(get(form.tainted)).toBe(root);
		expect(form.isTainted(root!.profile)).toBe(false);
		expect(received("group").tainted).toBe("false");
		expect(received("selected-group").tainted).toBe("false");
		expect(received("array-group").tainted).toBe("true");

		form.tainted.update((tainted) => {
			tainted!.rows![0].name = false;
			tainted!.rows![1].name = true;
			return tainted;
		});
		flushSync();
		expect(received("array-group").tainted).toBe("true");
		// Another array item cannot taint the selected leaf or object subtree.
		for (const id of ["array", "element", "element-group"])
			expect(received(id).tainted).toBe("false");

		form.tainted.update((tainted) => {
			tainted!.rows![1].name = false;
			tainted!.profile!.name = true;
			return tainted;
		});
		flushSync();
		expect(form.isTainted(root!.rows)).toBe(false);
		expect(received("array-group").tainted).toBe("false");
		expect(received("group").tainted).toBe("true");

		form.tainted.set({ profile: {}, rows: {} });
		flushSync();
		for (const id of [
			"group",
			"array-group",
			"selected-group",
			"array",
			"element",
			"element-group",
		]) {
			expect(received(id).tainted).toBe("false");
		}
		form.tainted.set(undefined);
		flushSync();
		expect(received("group").tainted).toBe("false");
		expect(received("array-group").tainted).toBe("false");
		expect(received("element-group").tainted).toBe("false");
	});

	it("selects array-shaped descendants and follows group name changes", async () => {
		const { form, consumer } = await mountConsumer();
		form.tainted.set({
			profile: { name: false, sibling: false },
			// The SDK traverses runtime arrays too, although its taint type models numeric records.
			rows: [{ name: false }, { name: true }] as unknown as NonNullable<
				TaintedFields<ReactivityData>["rows"]
			>,
		});
		flushSync();
		expect(received("selected-group").tainted).toBe("false");
		expect(received("array-group").tainted).toBe("true");
		consumer.switchGroupPath();
		flushSync();
		expect(received("selected-group").tainted).toBe("true");

		const root = get(form.tainted);
		form.tainted.update((tainted) => {
			tainted!.profile!.name = true;
			return tainted;
		});
		flushSync();
		expect(get(form.tainted)).toBe(root);
		expect(received("selected-group").tainted).toBe("true");
		form.tainted.update((tainted) => {
			tainted!.rows![1].name = false;
			return tainted;
		});
		flushSync();
		expect(received("selected-group").tainted).toBe("false");
		expect(received("group").tainted).toBe("true");
		consumer.switchGroupPath();
		flushSync();
		expect(received("selected-group").tainted).toBe("true");
	});

	it("follows an ElementField's selected object subtree through name changes and same-root updates", async () => {
		const { form, consumer } = await mountConsumer();
		expect(received("element-group").tainted).toBe("true");
		consumer.switchPaths();
		flushSync();
		expect(received("element-group").tainted).toBe("false");
		const root = get(form.tainted);
		form.tainted.update((tainted) => {
			tainted!.rows![0].name = false;
			return tainted;
		});
		flushSync();
		expect(get(form.tainted)).toBe(root);
		expect(received("element-group").tainted).toBe("false");
		form.tainted.update((tainted) => {
			tainted!.rows![1].name = true;
			return tainted;
		});
		flushSync();
		expect(received("element-group").tainted).toBe("true");
		expect(received("array-group").tainted).toBe("true");
		form.tainted.update((tainted) => {
			delete tainted!.rows![1].name;
			return tainted;
		});
		flushSync();
		expect(received("element-group").tainted).toBe("false");
		expect(received("array-group").tainted).toBe("false");
		expect(received("group").tainted).toBe("true");
	});
});

describe("snippet copies do not mutate Superforms stores", () => {
	it.each(["nested", "array", "element", "group"])(
		"isolates errors and selected constraints for %s",
		async (id) => {
			const { form } = await mountConsumer();
			const errors = structuredClone(get(form.errors));
			const constraints = structuredClone(get(form.constraints));
			const sibling = received("sibling");
			const before = received(id);
			const button = document.querySelector<HTMLButtonElement>(`button[data-mutate="${id}"]`);
			expect(button).not.toBeNull();
			button!.click();
			flushSync();

			const output = document.querySelector("output[data-mutation]");
			const mutation = JSON.parse(output!.textContent!) as {
				id: string;
				errors: string[];
				constraints: Record<string, unknown>;
			};
			expect(mutation.id).toBe(id);
			expect(mutation.errors).toEqual([...before.errors, `consumer ${id}`]);
			expect(mutation.constraints.required).toBe(false);
			if (id === "group") expect(mutation.constraints.name).toMatchObject({ minlength: 999 });
			expect(get(form.errors)).toEqual(errors);
			expect(get(form.constraints)).toEqual(constraints);
			expect(received("sibling")).toEqual(sibling);

			// Republishing the same store objects restores the original consumer copies.
			form.errors.update((root) => root, { force: true });
			form.constraints.update((root) => root);
			flushSync();
			const expectedErrors =
				id === "nested"
					? ["nested initial"]
					: id === "group"
						? ["group initial"]
						: ["row initial"];
			expect(received(id).errors).toEqual(expectedErrors);
			expect(received(id).constraints).toEqual(
				id === "nested"
					? constraints.profile!.name
					: id === "group"
						? constraints.profile
						: constraints.rows!.name
			);
		}
	);
});
