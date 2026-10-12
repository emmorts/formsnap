import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import RemoteFieldFixture from "./fixtures/remote-field.svelte";
import RemoteControlMisuse from "./fixtures/remote-control-misuse.svelte";
import BackendScope from "./fixtures/backend-scope.svelte";
import RemoteControlRoot from "./fixtures/remote-control-root.svelte";

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

		expect(control.name).toBe("opaque-handle-transport");
		expect(control.getAttribute("aria-invalid")).toBeNull();

		expect(control.id).toBeTruthy();
		expect(control.getAttribute("data-fs-control")).toBe("");
		expect(control.getAttribute("aria-required")).toBe("true");
		expect(control.hasAttribute("required")).toBe(false);

		expect(element("label").getAttribute("for")).toBe(control.id);
		const described = describedElements(control);
		expect(described.some((node) => node.textContent?.includes("Three characters"))).toBe(true);
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
		expect(control.getAttribute("aria-invalid")).toBe("true");
		expect(control.getAttribute("data-fs-error")).toBe("");
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

	it("isolates presentation metadata from backend issues and shared caller constraints", () => {
		const consumer = mountFixture();
		const issues = [{ message: "Too small", path: ["handle"] }];
		consumer.setHandle({ issues });
		flushSync();

		element<HTMLButtonElement>("[data-mutate-metadata]").click();
		flushSync();

		expect(JSON.parse(element("[data-backend-constraints]").textContent!)).toEqual({
			required: true,
			nested: { minlength: 3 },
		});
		expect(JSON.parse(element("[data-backend-issues]").textContent!)).toEqual([
			{ message: "Too small", path: ["handle"] },
		]);
		expect(element("[data-nickname-control]").getAttribute("aria-required")).toBe("true");
	});

	it("does not read the selected value when a snippet only consumes presentation metadata", () => {
		const consumer = mountFixture();
		expect(consumer.selectedValueReads()).toBe(0);
		consumer.setHandle({ issues: [{ message: "Too small", path: ["handle"] }] });
		flushSync();
		expect(consumer.selectedValueReads()).toBe(0);

		consumer.setHeadless("value-reader");
		flushSync();
		expect(element("[data-headless-value]").textContent).toBe("initial");
		expect(consumer.selectedValueReads()).toBe(1);
	});

	it("updates and releases headless associations while following source replacement", () => {
		const consumer = mountFixture();
		consumer.setHandle({ issues: [{ message: "Handle issue", path: ["handle"] }] });
		consumer.setHeadless("first");
		flushSync();
		const control = element<HTMLInputElement>("[data-handle-control]");
		const controlId = control.id;
		expect(element("[data-headless-value]").textContent).toBe("initial");
		expect(describedBy(control)).toContain("first-description");
		expect(describedBy(control)).toContain("first-errors");
		expect(element("#first-errors").textContent).toBe("Handle issue");

		consumer.setSibling([{ message: "Nickname issue", path: ["nickname"] }]);
		consumer.setSource(true);
		consumer.setHeadless("second");
		flushSync();
		expect(control.id).toBe(controlId);
		expect(control.value).toBe("nick");
		expect(element("[data-headless-value]").textContent).toBe("nick");
		expect(element("#second-errors").textContent).toBe("Nickname issue");
		expect(describedBy(control)).not.toContain("first-description");
		expect(describedBy(control)).not.toContain("first-errors");
		expect(describedBy(control)).toContain("second-description");
		expect(describedBy(control)).toContain("second-errors");
		describedElements(control);

		consumer.setHeadless(undefined);
		flushSync();
		expect(document.getElementById("second-description")).toBeNull();
		expect(document.getElementById("second-errors")).toBeNull();
		expect(describedBy(control)).not.toContain("second-description");
		expect(describedBy(control)).not.toContain("second-errors");
		describedElements(control);
	});

	it.each(["remote", "remote-state"] as const)(
		"rejects a Superforms scope in the %s hook",
		(hook) => {
			expect(() =>
				mount(BackendScope, {
					target: document.body,
					props: { scope: "root", hook },
				})
			).toThrow(/RemoteField/);
		}
	);

	it("rejects a remote scope in the Superforms hook", () => {
		expect(() =>
			mount(BackendScope, {
				target: document.body,
				props: { scope: "remote", hook: "root" },
			})
		).toThrow(/useRemoteFormField/);
	});

	it("presents a group with its own element, legend and standalone contributors", () => {
		const consumer = mountFixture();
		const fieldset = element<HTMLFieldSetElement>("fieldset[data-fs-fieldset]");
		const legend = element("legend");
		const control = element<HTMLInputElement>("[data-links-control]");

		expect(fieldset.contains(legend)).toBe(true);
		expect(legend.textContent).toBe("Links");
		expect(control.hasAttribute("name")).toBe(false);
		expect(describedElements(control).length).toBe(1);

		consumer.setGroup([{ message: "Pick a link", path: ["links"] }]);
		flushSync();

		expect(describedElements(control).length).toBe(2);

		expect(element("[data-links-issues]").getAttribute("data-links-issues")).toContain(
			"Pick a link"
		);
		expect(fieldset.getAttribute("data-fs-error")).toBe("");
	});

	it("keeps exact group errors inline and descendant issues in aggregate feedback", () => {
		const consumer = mountFixture();
		const fieldset = element<HTMLFieldSetElement>("fieldset[data-fs-fieldset]");
		consumer.setDescendant([{ message: "Invalid URL", path: ["links", 0, "url"] }]);
		flushSync();
		expect(fieldset.querySelector("[data-fs-field-errors]")!.textContent).toBe("");
		expect(fieldset.hasAttribute("data-fs-error")).toBe(false);

		consumer.setGroup([{ message: "Pick a link", path: ["links"] }]);
		flushSync();
		expect(fieldset.querySelector("[data-fs-field-errors]")!.textContent).toBe("Pick a link");
		expect(JSON.parse(element("[data-links-summary]").textContent!)).toEqual([
			{ message: "Pick a link", path: ["links"] },
			{ message: "Invalid URL", path: ["links", 0, "url"] },
		]);
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

		consumer.setContributors(false);
		flushSync();
		expect(describedBy(control)).toEqual([]);
		expect(contributors().length).toBe(0);

		// Repeated remounts must not retain associations to previous contributors.
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
		expect(() => {
			mount(RemoteControlMisuse, { target: document.body });
		}).toThrow(/transport owns the name attribute/);
	});

	it("rejects RemoteControl in a Superforms field rather than dropping its name", () => {
		expect(() => {
			mount(RemoteControlRoot, { target: document.body });
		}).toThrow(/Use Control/);
	});
});
