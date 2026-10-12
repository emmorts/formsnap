import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import RemoteFieldFixture from "./fixtures/remote-field.svelte";
import RemoteControlMisuse from "./fixtures/remote-control-misuse.svelte";

let mounted: Parameters<typeof unmount>[0] | undefined;

afterEach(async () => {
	if (mounted) await unmount(mounted);
	mounted = undefined;
	document.body.innerHTML = "";
});

function mountFixture() {
	const consumer = mount(RemoteFieldFixture, { target: document.body });
	mounted = consumer;
	flushSync();
	return consumer;
}

function element<T extends Element>(selector: string) {
	const found = document.querySelector<T>(selector);
	if (!found) throw new Error(`No element matched ${selector}`);
	return found;
}

function describedBy(control: Element) {
	return (control.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
}

/** The elements an `aria-describedby` list points at, which is what the association ids resolve to. */
function describedElements(control: Element) {
	return describedBy(control).map((id) => {
		const node = document.getElementById(id);
		if (!node) throw new Error(`aria-describedby references missing id ${id}`);
		return node;
	});
}

describe("remote presentation", () => {
	it("lets the transport own name and invalid state while presentation owns identity", () => {
		mountFixture();
		const control = element<HTMLInputElement>("[data-handle-control]");

		// Kit's `as(...)` props supply the transport name and the invalid state, in any spread order.
		expect(control.name).toBe("handle/1cuw750/saveRemote");
		expect(control.getAttribute("aria-invalid")).toBeNull();

		// Formsnap contributes identity, associations and styling, and never a second name.
		expect(control.id).toBeTruthy();
		expect(control.getAttribute("data-fs-control")).toBe("");
		expect(control.getAttribute("aria-required")).toBe("true");
		// An explicit constraint produces required-state metadata, never native validation.
		expect(control.hasAttribute("required")).toBe(false);

		// The label targets the rendered control, and the owned description is referenced by id.
		expect(element("label").getAttribute("for")).toBe(control.id);
		const described = describedElements(control);
		expect(described.some((node) => node.textContent?.includes("Three characters"))).toBe(true);
		// An error container is referenced only while there is something to announce.
		expect(described.some((node) => node.contains(element("[data-handle-errors]")))).toBe(
			false
		);
	});

	it("reports remote issues while leaving invalid state to the transport", () => {
		const consumer = mountFixture();
		const control = element<HTMLInputElement>("[data-handle-control]");
		expect(element("[data-handle-errors]").textContent).toBe("");

		consumer.setHandle({ issues: [{ message: "Too small", path: ["handle"] }] });
		flushSync();

		expect(element("[data-handle-errors]").textContent).toBe("Too small");
		expect(element("[data-handle-snippet]").getAttribute("data-handle-snippet")).toContain(
			'"Too small"'
		);
		// Kit's attribute appears because its props carry it, not because presentation added one.
		expect(control.getAttribute("aria-invalid")).toBe("true");
		expect(control.getAttribute("data-fs-error")).toBe("");
		// The error container joins the description once there is something to announce.
		expect(
			describedElements(control).some((node) =>
				node.contains(element("[data-handle-errors]"))
			)
		).toBe(true);
	});

	it("tracks Kit's value, touched and dirty state without calling it taint", () => {
		const consumer = mountFixture();
		const snippet = () => element("[data-handle-snippet]").getAttribute("data-handle-snippet");

		expect(snippet()).toContain('"touched":false');
		consumer.setHandle({ touched: true, dirty: true, value: "changed" });
		flushSync();

		expect(snippet()).toContain('"touched":true');
		expect(snippet()).toContain('"dirty":true');
		expect(element<HTMLInputElement>("[data-handle-control]").value).toBe("changed");
	});

	it("updates only the presentation of the field that changed", () => {
		const consumer = mountFixture();
		const nickControl = element<HTMLInputElement>("[data-nickname-control]");
		const handleControl = element<HTMLInputElement>("[data-handle-control]");
		const handleDescribed = describedBy(handleControl);

		consumer.setSibling([{ message: "Sibling only", path: ["nickname"] }]);
		flushSync();

		expect(nickControl.getAttribute("aria-invalid")).toBe("true");
		expect(handleControl.getAttribute("aria-invalid")).toBeNull();
		expect(handleControl.getAttribute("data-fs-error")).toBeNull();
		expect(element("[data-handle-errors]").textContent).toBe("");
		expect(describedBy(handleControl)).toEqual(handleDescribed);
		expect(element("[data-handle-snippet]").getAttribute("data-handle-snippet")).toContain(
			'"errors":[]'
		);
	});

	it("presents a group with its own element, legend and standalone contributors", () => {
		const consumer = mountFixture();
		const fieldset = element<HTMLFieldSetElement>("fieldset[data-fs-fieldset]");
		const legend = element("legend");
		const control = element<HTMLInputElement>("[data-links-control]");

		expect(fieldset.contains(legend)).toBe(true);
		expect(legend.textContent).toBe("Links");
		// A group has no `as()`, so nothing supplies a transport name, and presentation never invents one.
		expect(control.hasAttribute("name")).toBe(false);
		// A standalone Description mounted inside the group registers its own id; the error container
		// joins only once the group has something to announce.
		expect(describedElements(control).length).toBe(1);

		consumer.setGroup([{ message: "Pick a link", path: ["links"] }]);
		flushSync();

		expect(describedElements(control).length).toBe(2);

		expect(element("[data-links-issues]").getAttribute("data-links-issues")).toContain(
			"Pick a link"
		);
		expect(fieldset.getAttribute("data-fs-error")).toBe("");
	});

	it("keeps one registration per contributor across conditional remounts", () => {
		const consumer = mountFixture();
		const fieldset = element<HTMLFieldSetElement>("fieldset[data-fs-fieldset]");
		const control = element<HTMLInputElement>("[data-links-control]");
		const contributors = () =>
			fieldset.querySelectorAll("[data-fs-description], [data-fs-field-errors]");
		consumer.setGroup([{ message: "Pick a link", path: ["links"] }]);
		flushSync();
		expect(describedBy(control).length).toBe(2);
		expect(contributors().length).toBe(2);

		// Removing a contributor withdraws the association its owner registered, so the control stops
		// describing an element that is not there.
		consumer.setContributors(false);
		flushSync();
		expect(describedBy(control)).toEqual([]);
		expect(contributors().length).toBe(0);

		// Remounting them twenty-five times registers one owner each time and releases the previous one,
		// which is what keeps the list at one description and one error container rather than growing
		// with ids that no longer resolve.
		for (let index = 0; index < 25; index++) {
			consumer.setContributors(false);
			flushSync();
			consumer.setContributors(true);
			flushSync();
		}

		expect(describedElements(control).length).toBe(2);
		expect(contributors().length).toBe(2);
		expect(
			describedElements(control).some((node) =>
				node.textContent?.includes("One link per row.")
			)
		).toBe(true);
	});

	it("fails descriptively when the Superforms Control presents a remote field", () => {
		// `Control` reads a name that a remote field deliberately does not own, so the mistake must
		// name the right component instead of emitting a duplicate name or invalid state.
		expect(() => {
			mount(RemoteControlMisuse, { target: document.body });
		}).toThrow(/transport owns the name attribute/);
	});
});
