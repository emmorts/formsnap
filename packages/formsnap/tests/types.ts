/**
 * Public type cases. This module is never executed: `svelte-check` type-checks it through the
 * package tsconfig, so a regression in the exported types fails `pnpm check` and CI.
 */
import { expectTypeOf } from "vitest";
import type { SuperForm } from "sveltekit-superforms";
import type { ControlAttrs, LabelAttrs } from "$lib/attrs.types.js";
import type { ControlProps, FieldProps, FsSuperForm } from "$lib/index.js";
import type { SettingsData } from "../src/routes/schema.js";

// The documented pattern passes the `superForm` return value straight to the components.
expectTypeOf<SuperForm<SettingsData>>().toMatchTypeOf<FsSuperForm<SettingsData>>();

// Field names are constrained to the schema's own paths.
expectTypeOf<FieldProps<SettingsData, "email">["name"]>().toEqualTypeOf<"email">();

// Control accepts an explicit id, and the snippet props carry the attributes it promises.
expectTypeOf<ControlProps["id"]>().toEqualTypeOf<string | undefined>();
expectTypeOf<ControlAttrs["id"]>().toEqualTypeOf<string>();
expectTypeOf<ControlAttrs["aria-describedby"]>().toEqualTypeOf<string | undefined>();
expectTypeOf<ControlAttrs["aria-required"]>().toEqualTypeOf<"true" | undefined>();

// A label always names the control it belongs to.
expectTypeOf<LabelAttrs["for"]>().toEqualTypeOf<string>();
