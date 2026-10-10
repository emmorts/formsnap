import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import AnnouncementPolicies from "./fixtures/announcement-policies.svelte";
import { settingsSchema } from "../src/routes/schema.js";

let mounted: Parameters<typeof unmount>[0] | undefined;

afterEach(async () => {
	if (mounted) await unmount(mounted);
	mounted = undefined;
	document.body.innerHTML = "";
});

/** Both fields carry errors, so every region is rendered and referenced. */
async function mountPolicies() {
	const validated = await superValidate(
		{ email: "not-an-email", bio: "x".repeat(300) },
		zod(settingsSchema)
	);
	mounted = mount(AnnouncementPolicies, { target: document.body, props: { validated } });
	flushSync();
}

const liveOf = (id: string) => document.getElementById(id)?.getAttribute("aria-live");

const describedBy = (name: string) =>
	(document.querySelector(`[name="${name}"]`)?.getAttribute("aria-describedby") ?? "")
		.split(/\s+/)
		.filter(Boolean);

describe("announcement policy", () => {
	it("resolves the policy of every container, with the prop ahead of a spread attribute", async () => {
		await mountPolicies();

		// The owning component sets the policy of the region it renders.
		expect(liveOf("email-errors")).toBe("polite");
		// A standalone region keeps the default when nothing asks for another policy …
		expect(liveOf("bio-default")).toBe("assertive");
		// … accepts an `aria-live` spread with the other attributes …
		expect(liveOf("bio-spread")).toBe("polite");
		// … and lets the prop win when both are given.
		expect(liveOf("bio-prop-wins")).toBe("off");
	});

	it("keeps the association and the invalid state independent of the policy", async () => {
		await mountPolicies();

		for (const name of ["email", "bio"]) {
			expect(document.querySelector(`[name="${name}"]`)?.getAttribute("aria-invalid")).toBe(
				"true"
			);
		}
		expect(describedBy("email")).toEqual(["email-errors"]);
		expect(describedBy("bio")).toEqual(["bio-default", "bio-spread", "bio-prop-wins"]);
		expect(document.getElementById("bio-prop-wins")?.textContent?.trim()).toBeTruthy();
	});

	it("follows a policy change on the rendered container", async () => {
		await mountPolicies();

		document.querySelector("button")?.click();
		flushSync();
		expect(liveOf("email-errors")).toBe("off");

		document.querySelector("button")?.click();
		flushSync();
		expect(liveOf("email-errors")).toBe("polite");
		expect(describedBy("email")).toEqual(["email-errors"]);
	});
});
