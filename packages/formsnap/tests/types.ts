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
	UseFormFieldResult,
} from "$lib/index.js";
import type { SettingsData } from "../src/routes/schema.js";
import { useFormField } from "$lib/index.js";
import type { FormPathValue } from "$lib/internal/form-path.js";

// The documented pattern passes the `superForm` return value straight to the components.
expectTypeOf<SuperForm<SettingsData>>().toMatchTypeOf<FsSuperForm<SettingsData>>();

type StatusMessage = { status: "saved" | "invalid"; detail: string };
type HeadlessField = UseFormFieldResult<Paths, "items[0].id", StatusMessage>;
const typedField = useFormField<Paths, "items[0].id", StatusMessage>({});
expectTypeOf<typeof typedField>().toEqualTypeOf<HeadlessField>();
expectTypeOf<HeadlessField["form"]>().toEqualTypeOf<FsSuperForm<Paths, StatusMessage>>();
expectTypeOf<HeadlessField["form"]["message"]>().toEqualTypeOf<
	SuperForm<Paths, StatusMessage>["message"]
>();
expectTypeOf<HeadlessField["name"]>().toEqualTypeOf<"items[0].id">();
expectTypeOf<SuperForm<Paths, StatusMessage>>().toMatchTypeOf<FsSuperForm<Paths, StatusMessage>>();

type OptionalMethods =
	"validate" | "validateForm" | "enhance" | "isTainted" | "reset" | "options" | "restore";
type PresentationForm = Omit<SuperForm<Paths, StatusMessage>, OptionalMethods>;
expectTypeOf<PresentationForm>().toMatchTypeOf<FsSuperForm<Paths, StatusMessage>>();
expectTypeOf<NonNullable<HeadlessField["form"]["validate"]>>().toEqualTypeOf<
	SuperForm<Paths, StatusMessage>["validate"]
>();
expectTypeOf<NonNullable<HeadlessField["form"]["validateForm"]>>().toEqualTypeOf<
	SuperForm<Paths, StatusMessage>["validateForm"]
>();
expectTypeOf<NonNullable<HeadlessField["form"]["enhance"]>>().toEqualTypeOf<
	SuperForm<Paths, StatusMessage>["enhance"]
>();
expectTypeOf<NonNullable<HeadlessField["form"]["isTainted"]>>().toEqualTypeOf<
	SuperForm<Paths, StatusMessage>["isTainted"]
>();
expectTypeOf<NonNullable<HeadlessField["form"]["reset"]>>().toEqualTypeOf<
	SuperForm<Paths, StatusMessage>["reset"]
>();
expectTypeOf<NonNullable<HeadlessField["form"]["options"]>>().toEqualTypeOf<
	SuperForm<Paths, StatusMessage>["options"]
>();
expectTypeOf<NonNullable<HeadlessField["form"]["restore"]>>().toEqualTypeOf<
	SuperForm<Paths, StatusMessage>["restore"]
>();

typedField.form.validate?.("items[0].id", { value: 7 });
typedField.form.validateForm?.({ update: true });
typedField.form.reset?.({ data: { profile: { name: "Ada" } } });
typedField.form.message.set({ status: "saved", detail: "Saved" });
typedField.form.restore?.(typedField.form.capture());
// @ts-expect-error The hook does not erase the message shape.
typedField.form.message.set("Saved");
// @ts-expect-error Validation paths still belong to the schema.
typedField.form.validate?.("profile.missing");
// @ts-expect-error Validation values retain the selected leaf type.
typedField.form.validate?.("items[0].id", { value: "seven" });
// @ts-expect-error Validation options retain their boolean contract.
typedField.form.validateForm?.({ update: "yes" });
// @ts-expect-error Enhancement requires a form element.
typedField.form.enhance?.("form");
// @ts-expect-error Reset data retains schema field types.
typedField.form.reset?.({ data: { profile: { name: 7 } } });
// @ts-expect-error Taint accepts a path/subtree/boolean, not an arbitrary number.
typedField.form.isTainted?.(7);
// @ts-expect-error Snapshot restore requires the captured form structure.
typedField.form.restore?.({ message: { status: "saved", detail: "Saved" } });
// @ts-expect-error Supplied SDK methods must be callable with the SDK contract.
const invalidMethod: FsSuperForm<Paths, StatusMessage>["reset"] = "reset";
export { invalidMethod };

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
expectTypeOf<SnippetValue<FieldProps<Paths, "urls[0]">>>().toEqualTypeOf<string | undefined>();
expectTypeOf<SnippetValue<FieldProps<Paths, "items[0].id">>>().toEqualTypeOf<number | undefined>();
expectTypeOf<SnippetValue<FieldProps<Paths, "profile">>>().toEqualTypeOf<{ name: string }>();
expectTypeOf<SnippetValue<FieldsetProps<Paths, "profile">>>().toEqualTypeOf<{ name: string }>();
expectTypeOf<SnippetValue<FieldProps<Paths, "matrix[0][1]">>>().toEqualTypeOf<string | undefined>();
expectTypeOf<SnippetValue<ElementFieldProps<Paths, "urls[0]">>>().toEqualTypeOf<
	string | undefined
>();
expectTypeOf<SnippetValue<ElementFieldProps<Paths, "items[0].id">>>().toEqualTypeOf<
	number | undefined
>();
expectTypeOf<SnippetValue<ElementFieldProps<Paths, "matrix[0][1]">>>().toEqualTypeOf<
	string | undefined
>();
expectTypeOf<FormPathValue<Paths, "urls">>().toEqualTypeOf<string[]>();
expectTypeOf<FormPathValue<Paths, "items[0]">>().toEqualTypeOf<{ id: number } | undefined>();
expectTypeOf<FormPathValue<Paths, "matrix[0]">>().toEqualTypeOf<string[] | undefined>();
expectTypeOf<FormPathValue<Paths, `items[${number}].id`>>().toEqualTypeOf<number | undefined>();

type TuplePaths = {
	pair: [string, { id: number }];
	optional: [string, number?];
	mixed: [string, ...number[]];
	matrices: [string[], [boolean, number]];
};
expectTypeOf<SnippetValue<FieldProps<TuplePaths, "pair[0]">>>().toEqualTypeOf<string>();
expectTypeOf<FormPathValue<TuplePaths, "pair[1].id">>().toEqualTypeOf<number>();
expectTypeOf<FormPathValue<TuplePaths, "optional[1]">>().toEqualTypeOf<number | undefined>();
expectTypeOf<FormPathValue<TuplePaths, "pair[9]">>().toEqualTypeOf<undefined>();
expectTypeOf<FormPathValue<TuplePaths, "mixed[0]">>().toEqualTypeOf<string>();
expectTypeOf<FormPathValue<TuplePaths, "mixed[9]">>().toEqualTypeOf<string | number | undefined>();
expectTypeOf<FormPathValue<TuplePaths, "matrices[0][0]">>().toEqualTypeOf<string | undefined>();
expectTypeOf<FormPathValue<TuplePaths, "matrices[1][0]">>().toEqualTypeOf<boolean>();
expectTypeOf<FormPathValue<TuplePaths, `pair[${number}]`>>().toEqualTypeOf<
	string | { id: number } | undefined
>();

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
type LiteralArrayKey = { "items[0].id": number; "matrix[0][1]": string };
expectTypeOf<SnippetValue<FieldProps<LiteralArrayKey, "items[0].id">>>().toEqualTypeOf<number>();
expectTypeOf<SnippetValue<FieldProps<LiteralArrayKey, "matrix[0][1]">>>().toEqualTypeOf<string>();
expectTypeOf<FormPathValue<{ rows: ({ id: number } | null)[] }, "rows[0].id">>().toEqualTypeOf<
	number | undefined
>();

// Invalid paths must fail the public generic constraint, not silently resolve to `never`.
// @ts-expect-error Field paths must belong to the form schema.
type InvalidField = FieldProps<Paths, "profile.missing">;
// @ts-expect-error Element paths must resolve to a leaf.
type InvalidElement = ElementFieldProps<Paths, "items[0].missing">;
// @ts-expect-error Fieldset paths must belong to the form schema.
type InvalidFieldset = FieldsetProps<Paths, "absent">;

// Keep the negative cases part of the type-checked public-contract module.
export type { InvalidField, InvalidElement, InvalidFieldset };
