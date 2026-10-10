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

// Owned content is optional and IDs are overrides, not declarations by themselves.
type ErrorContent = Snippet<[{ errors: string[]; errorProps: Record<string, unknown> }]>;
expectTypeOf<FieldProps<SettingsData, "email">["description"]>().toEqualTypeOf<
	Snippet | undefined
>();
expectTypeOf<FieldProps<SettingsData, "email">["fieldErrors"]>().toEqualTypeOf<
	boolean | ErrorContent | undefined
>();
expectTypeOf<FieldProps<SettingsData, "email">["descriptionId"]>().toEqualTypeOf<
	string | undefined
>();
expectTypeOf<FieldProps<SettingsData, "email">["fieldErrorsId"]>().toEqualTypeOf<
	string | undefined
>();
expectTypeOf<ElementFieldProps<Paths, "urls[0]">["description"]>().toEqualTypeOf<
	Snippet | undefined
>();
expectTypeOf<ElementFieldProps<Paths, "urls[0]">["fieldErrors"]>().toEqualTypeOf<
	boolean | ErrorContent | undefined
>();
expectTypeOf<ElementFieldProps<Paths, "urls[0]">["descriptionId"]>().toEqualTypeOf<
	string | undefined
>();
expectTypeOf<ElementFieldProps<Paths, "urls[0]">["fieldErrorsId"]>().toEqualTypeOf<
	string | undefined
>();
expectTypeOf<FieldsetProps<Paths, "profile">["description"]>().toEqualTypeOf<Snippet | undefined>();
expectTypeOf<FieldsetProps<Paths, "profile">["fieldErrors"]>().toEqualTypeOf<
	boolean | ErrorContent | undefined
>();
expectTypeOf<FieldsetProps<Paths, "profile">["descriptionId"]>().toEqualTypeOf<
	string | undefined
>();
expectTypeOf<FieldsetProps<Paths, "profile">["fieldErrorsId"]>().toEqualTypeOf<
	string | undefined
>();

declare const groupForm: SuperForm<Paths>;
declare const descriptionContent: Snippet;
declare const errorContent: ErrorContent;
declare const customGroup: NonNullable<FieldsetProps<Paths, "profile">["child"]>;
const nativeOwnedGroup: FieldsetProps<Paths, "profile"> = {
	form: groupForm,
	name: "profile",
	description: descriptionContent,
	fieldErrors: errorContent,
	descriptionId: "profile-help",
	fieldErrorsId: "profile-errors",
};
const unownedCustomGroup: FieldsetProps<Paths, "profile"> = {
	form: groupForm,
	name: "profile",
	child: customGroup,
	fieldErrors: false,
	descriptionId: "unused-help",
	fieldErrorsId: "unused-errors",
};
// @ts-expect-error A whole-container child cannot guarantee the owned description container.
const customGroupWithDescription: FieldsetProps<Paths, "profile"> = {
	form: groupForm,
	name: "profile",
	child: customGroup,
	description: descriptionContent,
};
// @ts-expect-error A whole-container child cannot guarantee default owned errors.
const customGroupWithDefaultErrors: FieldsetProps<Paths, "profile"> = {
	form: groupForm,
	name: "profile",
	child: customGroup,
	fieldErrors: true,
};
// @ts-expect-error A whole-container child cannot guarantee custom owned error content.
const customGroupWithErrorContent: FieldsetProps<Paths, "profile"> = {
	form: groupForm,
	name: "profile",
	child: customGroup,
	fieldErrors: errorContent,
};
// @ts-expect-error Owned descriptions accept content-only snippets, not container props.
const invalidDescription: FieldProps<SettingsData, "email">["description"] = errorContent;
// @ts-expect-error Owned errors always provide string[] errors to custom content.
const invalidErrors: FieldProps<SettingsData, "email">["fieldErrors"] = {} as Snippet<
	[{ errors: number[]; errorProps: Record<string, unknown> }]
>;
export {
	nativeOwnedGroup,
	unownedCustomGroup,
	customGroupWithDescription,
	customGroupWithDefaultErrors,
	customGroupWithErrorContent,
	invalidDescription,
	invalidErrors,
};
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
