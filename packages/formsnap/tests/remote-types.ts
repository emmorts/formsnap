/**
 * Compile-only contracts checked by svelte-check. Derive Kit field types from real form values;
 * SvelteKit does not export those types from @sveltejs/kit.
 */
import { expectTypeOf } from "vitest";
import { saveRemote } from "../src/routes/remote/save.remote.js";

const fields = saveRemote.fields;

// ── Valid field/input combinations infer ────────────────────────────────────────────────────────

fields.handle.as("text");
fields.handle.as("text", "Ada");
fields.seats.as("number");
fields.notifications.as("checkbox");

// ── Invalid combinations fail ───────────────────────────────────────────────────────────────────

// @ts-expect-error A string leaf is not a number input.
fields.handle.as("number");
// @ts-expect-error A number leaf is not a checkbox.
fields.seats.as("checkbox");
// @ts-expect-error A radio input needs a value.
fields.handle.as("radio");

// ── Group fields cannot be used as scalar controls ──────────────────────────────────────────────

// An object array resolves to a container plus index accessors; only leaves expose `as()`, which is
// the type-level reason a group cannot be rendered as one control.
// @ts-expect-error A container is not a scalar control.
fields.links.as("text");
// @ts-expect-error A container is not a scalar control either, whatever the input type.
fields.links.as("select");

// ── Structured issue access ─────────────────────────────────────────────────────────────────────

expectTypeOf(fields.handle.issues()).toEqualTypeOf<
	{ message: string; path: Array<string | number> }[] | undefined
>();
expectTypeOf(fields.links.allIssues()).toEqualTypeOf<
	{ message: string; path: Array<string | number> }[] | undefined
>();
expectTypeOf(fields.links[0].url.issues()).toEqualTypeOf<
	{ message: string; path: Array<string | number> }[] | undefined
>();

// ── The form owns transport and submission ──────────────────────────────────────────────────────

expectTypeOf(saveRemote.method).toEqualTypeOf<"POST">();
expectTypeOf(saveRemote.action).toEqualTypeOf<string>();
expectTypeOf(saveRemote.pending).toEqualTypeOf<number>();
expectTypeOf(saveRemote.submitted).toEqualTypeOf<boolean>();

// Kit 3's real option names, not the stale `includeUntouched` the published guide still shows.
saveRemote.validate({ all: true });
saveRemote.validate({ preflightOnly: true });
// @ts-expect-error The released runtime does not accept `includeUntouched`.
saveRemote.validate({ includeUntouched: true });
