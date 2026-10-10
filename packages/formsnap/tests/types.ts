/**
 * Public type cases. This module is never executed: `svelte-check` type-checks it through the
 * package tsconfig, so a regression in the exported types fails `pnpm check` and CI.
 */
import { expectTypeOf } from "vitest";
import type { Snippet } from "svelte";
import type { SuperForm } from "sveltekit-superforms";
import type { ControlAttrs, LabelAttrs } from "$lib/attrs.types.js";
import type {
	ControlProps,
	ElementFieldProps,
	FieldProps,
	FieldsetProps,
	FsSuperForm,
} from "$lib/index.js";
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
	matrix: string[][];
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
expectTypeOf<SnippetValue<FieldProps<Paths, "matrix[0][1]">>>().toEqualTypeOf<string>();
expectTypeOf<SnippetValue<ElementFieldProps<Paths, "urls[0]">>>().toEqualTypeOf<string>();
expectTypeOf<SnippetValue<ElementFieldProps<Paths, "items[0].id">>>().toEqualTypeOf<number>();
expectTypeOf<SnippetValue<ElementFieldProps<Paths, "matrix[0][1]">>>().toEqualTypeOf<string>();

// An optional field keeps its `undefined`.
expectTypeOf<SnippetValue<FieldProps<Paths, "nickname">>>().toEqualTypeOf<string | undefined>();
expectTypeOf<SnippetValue<ElementFieldProps<Paths, "nickname">>>().toEqualTypeOf<
	string | undefined
>();

type OptionalParents = {
	profile?: { name: string };
	urls?: string[];
	group?: { profile: { name: string } };
	nullable: { name: string } | null;
};
expectTypeOf<SnippetValue<FieldProps<OptionalParents, "profile.name">>>().toEqualTypeOf<
	string | undefined
>();
expectTypeOf<SnippetValue<FieldProps<OptionalParents, "urls[0]">>>().toEqualTypeOf<
	string | undefined
>();
expectTypeOf<SnippetValue<ElementFieldProps<OptionalParents, "urls[0]">>>().toEqualTypeOf<
	string | undefined
>();
expectTypeOf<SnippetValue<FieldsetProps<OptionalParents, "group.profile">>>().toEqualTypeOf<
	{ name: string } | undefined
>();
expectTypeOf<SnippetValue<ElementFieldProps<OptionalParents, "nullable.name">>>().toEqualTypeOf<
	string | undefined
>();

type LiteralKey = { "contact.email": string };
expectTypeOf<SnippetValue<FieldProps<LiteralKey, "contact.email">>>().toEqualTypeOf<string>();

// Invalid paths must fail the public generic constraint, not silently resolve to `never`.
// @ts-expect-error Field paths must belong to the form schema.
type InvalidField = FieldProps<Paths, "profile.missing">;
// @ts-expect-error Element paths must resolve to a leaf.
type InvalidElement = ElementFieldProps<Paths, "items[0].missing">;
// @ts-expect-error Fieldset paths must belong to the form schema.
type InvalidFieldset = FieldsetProps<Paths, "absent">;

// Keep the negative cases part of the type-checked public-contract module.
export type { InvalidField, InvalidElement, InvalidFieldset };
