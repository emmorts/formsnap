/* eslint-disable @typescript-eslint/no-explicit-any */
import type { HTMLAttributes, HTMLFieldsetAttributes, HTMLLabelAttributes } from "svelte/elements";
import type { FormPath, FormPathLeaves, SuperForm } from "sveltekit-superforms";
import type { Snippet } from "svelte";
import type { Expand, WithChild, Without } from "svelte-toolbelt";
import type { ControlAttrs } from "$lib/attrs.types.js";
import type { FormPathValue, Primitive } from "$lib/internal/types.js";

type PrimitiveFieldSetAttributes = Primitive<HTMLFieldsetAttributes>;
type PrimitiveDivAttributes = Primitive<HTMLAttributes<HTMLDivElement>>;
type PrimitiveLabelAttributes = Primitive<HTMLLabelAttributes>;
type PrimitiveLegendAttributes = Primitive<HTMLAttributes<HTMLLegendElement>>;

export type FsSuperForm<T extends Record<string, unknown>, M = any> = Omit<
	SuperForm<T, M>,
	"validate" | "validateForm" | "enhance" | "isTainted" | "reset" | "options" | "restore"
> & {
	validate?: any;
	validateForm?: any;
	enhance?: any;
	isTainted?: any;
	reset?: any;
	options?: any;
	restore?: any;
};

/** Content rendered inside containers owned by a field scope. */
export type OwnedFieldContentProps = {
	/** Content-only description; the scope renders its container after children. */
	description?: Snippet;
	/** Enable default error content, or provide content for the owned error container. */
	fieldErrors?: boolean | Snippet<[{ errors: string[]; errorProps: Record<string, unknown> }]>;
	/** Override the owned description ID. Ignored when description is absent. */
	descriptionId?: string;
	/** Override the owned errors ID. Ignored when fieldErrors is false or absent. */
	fieldErrorsId?: string;
};

/**
 * Props for the [Description](https://formsnap.dev/docs/components/description) component.
 */
export type DescriptionPropsWithoutHTML = WithChild<{}>;

export type DescriptionProps = DescriptionPropsWithoutHTML &
	Without<PrimitiveDivAttributes, DescriptionPropsWithoutHTML>;

/**
 * Props for the [Field](https://formsnap.dev/docs/components/field) component.
 */
export type FieldProps<
	T extends Record<string, unknown>,
	U extends FormPath<T>,
	M = any,
> = OwnedFieldContentProps & {
	/**
	 * The form object returned from calling `superForm` in your component.
	 */
	form: FsSuperForm<T, M>;

	/**
	 * The path to the field in the form object.
	 *
	 * @required
	 */
	name: U;

	/**
	 * The children of the field.
	 */
	children?: Snippet<
		[
			{
				value: FormPathValue<T, U>;
				errors: string[];
				tainted: boolean;
				constraints: Record<string, unknown>;
			},
		]
	>;
};

/**
 * Props for the [ElementField](https://formsnap.dev/docs/components/element-field) component.
 *
 * @category ElementField
 */
export type ElementFieldProps<
	T extends Record<string, unknown>,
	U extends FormPathLeaves<T>,
	M = any,
> = OwnedFieldContentProps & {
	/**
	 * The form object returned from calling `superForm` in your component.
	 */
	form: FsSuperForm<T, M>;

	/**
	 * The path to the field in the form object.
	 *
	 * @required
	 */
	name: U;

	/**
	 * The children of the field.
	 */
	children?: Snippet<
		[
			{
				value: FormPathValue<T, U>;
				errors: string[];
				tainted: boolean;
				constraints: Record<string, unknown>;
			},
		]
	>;
};

/**
 * Props for the [Fieldset](https://formsnap.dev/docs/components/fieldset) component.
 * This component is used to group form controls together and if used, should always
 * have a child [Legend](https://formsnap.dev/docs/components/legend) component to provide
 * an accessible title for the group.
 *
 * @see {@link https://www.w3.org/WAI/tutorials/forms/grouping/ W3C Grouping}
 */
export type FieldsetPropsWithoutHTML<
	T extends Record<string, unknown>,
	U extends FormPath<T>,
	M = any,
> = WithChild<
	{
		/**
		 * The form object returned from calling `superForm` in your component.
		 */
		form: FsSuperForm<T, M>;

		/**
		 * The path to the field in the form object.
		 */
		name: U;
	},
	{
		value: FormPathValue<T, U>;
		errors: string[];
		tainted: boolean;
		constraints: Record<string, unknown>;
	}
> &
	(
		| (OwnedFieldContentProps & { child?: never })
		| {
				description?: never;
				fieldErrors?: false;
				descriptionId?: string;
				fieldErrorsId?: string;
		  }
	);

export type FieldsetProps<
	T extends Record<string, unknown>,
	U extends FormPath<T>,
	M = any,
> = FieldsetPropsWithoutHTML<T, U, M> &
	Without<PrimitiveFieldSetAttributes, FieldsetPropsWithoutHTML<T, U, M>>;

/**
 * Props for the [Control](https://formsnap.dev/docs/components/control) component.
 */
export type ControlProps = {
	/**
	 * Optionally provide a unique id for the form control.
	 * If not provided, a unique ID will be generated for you.
	 */
	id?: string;
	children?: Snippet<[{ props: Expand<ControlAttrs> }]>;
};

export type LabelPropsWithoutHTML = WithChild<{}>;

/**
 * Props for the [Label](https://formsnap.dev/docs/components/label) component.
 */
export type LabelProps = LabelPropsWithoutHTML &
	Without<PrimitiveLabelAttributes, LabelPropsWithoutHTML>;

export type LegendPropsWithoutHTML = WithChild;

/**
 * Props for the [Legend](https://formsnap.dev/docs/components/legend) component.
 * This component is used to provide an accessible title for a group of form controls.
 *
 * @see {@link https://www.w3.org/WAI/tutorials/forms/grouping/ W3C Grouping}
 */
export type LegendProps = LegendPropsWithoutHTML &
	Without<PrimitiveLegendAttributes, LegendPropsWithoutHTML>;

/**
 * Props for the [FieldErrors](https://formsnap.dev/docs/components/field-errors) component.
 */
export type FieldErrorsPropsWithoutHTML = WithChild<
	{},
	{
		errors: string[];
		errorProps: Record<string, unknown>;
	}
>;

export type FieldErrorsProps = FieldErrorsPropsWithoutHTML &
	Without<PrimitiveDivAttributes, FieldErrorsPropsWithoutHTML>;
