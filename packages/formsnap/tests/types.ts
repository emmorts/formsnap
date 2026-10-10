/**
 * Public type cases. This module is never executed: `svelte-check` type-checks it through the
 * package tsconfig, so a regression in the exported types fails `pnpm check` and CI.
 */
import { expectTypeOf } from "vitest";
import type { Snippet } from "svelte";
import type { SuperForm } from "sveltekit-superforms";
import type { ControlAttrs, LabelAttrs } from "$lib/attrs.types.js";
import type { ControlProps, FieldProps, FieldsetProps, FsSuperForm } from "$lib/index.js";
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

type Paths = {
	profile: { name: string };
	urls: string[];
	items: { id: number }[];
	nickname?: string;
};

/** The value a component's snippet receives for the path it was given. */
type SnippetValue<Props> = Props extends { children?: Snippet<[infer Props_, ...unknown[]]> }
	? Props_ extends { value: infer Value }
		? Value
		: never
	: never;

// The snippet value is the value at the path, not the top-level field or an index signature.
expectTypeOf<SnippetValue<FieldProps<Paths, "profile.name">>>().toEqualTypeOf<string>();
expectTypeOf<SnippetValue<FieldProps<Paths, "urls[0]">>>().toEqualTypeOf<string>();
expectTypeOf<SnippetValue<FieldProps<Paths, "items[0].id">>>().toEqualTypeOf<number>();
expectTypeOf<SnippetValue<FieldProps<Paths, "profile">>>().toEqualTypeOf<{ name: string }>();
expectTypeOf<SnippetValue<FieldsetProps<Paths, "profile">>>().toEqualTypeOf<{ name: string }>();

// An optional field keeps its `undefined`.
expectTypeOf<SnippetValue<FieldProps<Paths, "nickname">>>().toEqualTypeOf<string | undefined>();
