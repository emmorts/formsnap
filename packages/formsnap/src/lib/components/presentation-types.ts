import type { HTMLAttributes, HTMLFieldsetAttributes, HTMLLabelAttributes } from "svelte/elements";
import type { Snippet } from "svelte";
import type { Expand, WithChild, Without } from "svelte-toolbelt";
import type { ControlAttrs, FieldErrorsLive } from "$lib/attrs.types.js";
import type { Primitive } from "$lib/internal/types.js";

/**
 * Prop types of the presentation components: `Control`, `Label`, `Description`, `FieldErrors`,
 * `Legend`, and the description/error content a field scope owns.
 *
 * Nothing here may import `sveltekit-superforms`. The remote entry re-exports these components, so
 * their declarations are part of a remote-only consumer's type-check, and that consumer does not
 * install Superforms. The Superforms-typed field and fieldset props are in `types.ts`, which
 * re-exports this module for the root entry.
 */

type PrimitiveFieldSetAttributes = Primitive<HTMLFieldsetAttributes>;
type PrimitiveDivAttributes = Primitive<HTMLAttributes<HTMLDivElement>>;
type PrimitiveLabelAttributes = Primitive<HTMLLabelAttributes>;
type PrimitiveLegendAttributes = Primitive<HTMLAttributes<HTMLLegendElement>>;

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
	/** Announcement policy for the owned error region. Ignored when fieldErrors is false or absent. */
	fieldErrorsLive?: FieldErrorsLive;
};

/**
 * Props for the [Description](https://formsnap.dev/docs/components/description) component.
 */
export type DescriptionPropsWithoutHTML = WithChild<{}>;

export type DescriptionProps = DescriptionPropsWithoutHTML &
	Without<PrimitiveDivAttributes, DescriptionPropsWithoutHTML>;

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
	{
		/**
		 * The announcement policy for the errors container. Defaults to `"assertive"`, and takes
		 * precedence over an `aria-live` attribute passed with the other props.
		 */
		live?: FieldErrorsLive;
	},
	{
		errors: string[];
		errorProps: Record<string, unknown>;
	}
>;

export type FieldErrorsProps = FieldErrorsPropsWithoutHTML &
	Without<PrimitiveDivAttributes, FieldErrorsPropsWithoutHTML>;

/** The element attributes of the Superforms `Fieldset`, used by the props left in `types.ts`. */
export type { PrimitiveFieldSetAttributes };
