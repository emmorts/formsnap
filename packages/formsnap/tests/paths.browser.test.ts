import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import Paths from "./fixtures/paths.svelte";
import { pathsSchema, type PathsData } from "./fixtures/paths-schema.js";

let mounted: Parameters<typeof unmount>[0] | undefined;

afterEach(() => {
	if (mounted) unmount(mounted);
	mounted = undefined;
	document.body.innerHTML = "";
});

const sample: PathsData = {
	profile: { name: "Ada" },
	urls: ["https://example.com"],
	items: [{ id: 7 }],
	matrix: [["a", "b"]],
};

async function mountPaths(data: Partial<PathsData>) {
	const validated = await superValidate(data, zod(pathsSchema));
	mounted = mount(Paths, { target: document.body, props: { validated } });
	flushSync();
}

/** What the fixture recorded for the snippet of that path. */
function received(path: string) {
	const output = document.querySelector(`output[data-path="${path}"]`);
	expect(output, `output for ${path}`).not.toBeNull();
	return {
		value: output?.getAttribute("data-value"),
		errors: JSON.parse(output?.getAttribute("data-errors") ?? "[]") as string[],
		tainted: output?.getAttribute("data-tainted"),
		constraints: JSON.parse(output?.getAttribute("data-constraints") ?? "{}") as Record<
			string,
			unknown
		>,
	};
}

describe("values delivered at a path", () => {
	it("resolves nested objects, array elements, nested arrays and missing values", async () => {
		await mountPaths(sample);

		expect(received("profile.name").value).toBe('"Ada"');
		expect(received("urls[0]").value).toBe('"https://example.com"');
		expect(received("items[0].id").value).toBe("7");
		expect(received("matrix[0][1]").value).toBe('"b"');
		expect(received("nickname").value).toBe("<missing>");
		expect(received("profile").value).toBe('{"name":"Ada"}');
	});

	it("delivers later data changes to the consumer", async () => {
		await mountPaths(sample);

		const input = document.querySelector<HTMLInputElement>('[name="profile.name"]');
		expect(input, "the bound input").not.toBeNull();
		expect(received("profile.name").tainted).toBe("false");

		input!.value = "Grace";
		input!.dispatchEvent(new Event("input", { bubbles: true }));
		flushSync();

		expect(received("profile.name").value).toBe('"Grace"');
		expect(received("profile.name").tainted).toBe("true");
	});

	it("delivers the constraints Superforms reports for the path", async () => {
		await mountPaths(sample);

		expect(received("profile.name").constraints).toMatchObject({ minlength: 2 });
	});

	it("follows the field when its path changes", async () => {
		await mountPaths(sample);

		expect(received("switching").value).toBe('"Ada"');

		const button = [...document.querySelectorAll("button")].find((element) =>
			element.textContent?.includes("switch path")
		);
		button?.click();
		flushSync();

		expect(received("switching").value).toBe("7");
	});
});

describe("errors delivered at a path", () => {
	it("reports the error of an array element", async () => {
		await mountPaths({ ...sample, urls: ["not-a-url"] });

		expect(received("urls[0]").errors.length).toBeGreaterThan(0);
	});

	it("reports the error of a nested object property", async () => {
		await mountPaths({ ...sample, profile: { name: "A" } });

		expect(received("profile.name").errors.length).toBeGreaterThan(0);
	});
});
