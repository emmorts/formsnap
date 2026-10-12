/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FormPath, FormPathLeaves, SuperForm } from "sveltekit-superforms";
import type { Snippet } from "svelte";
import type { WithChild, Without } from "svelte-toolbelt";
import type { FieldErrorsLive } from "$lib/attrs.types.js";
import type { FormPathValue } from "$lib/internal/form-path.js";
import type { OwnedFieldContentProps, PrimitiveFieldSetAttributes } from "./presentation-types.js";

/**
 * The Superforms-typed props, and nothing else: these types name `SuperForm`, `FormPath` and the
 * path lookup, so this module cannot be part of the remote entry's declarations. The presentation
 * components' props, which a remote-only consumer does resolve, are in `presentation-types.ts`.
 *
 * Re-exporting them here keeps `@emmorts/formsnap`'s type surface unchanged.
 */
export type * from "./presentation-types.js";

/** Presentation wrappers may omit SDK methods, but supplied members keep SDK types. */
type OptionalSuperFormMembers =
	"validate" | "validateForm" | "enhance" | "isTainted" | "reset" | "options" | "restore";

export type FsSuperForm<T extends Record<string, unknown>, M = any> = Omit<
	SuperForm<T, M>,
	OptionalSuperFormMembers
> &
	Partial<Pick<SuperForm<T, M>, OptionalSuperFormMembers>>;

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
	 * Keep this instance for the mounted field's lifetime. To replace it, key the
	 * entire field subtree by the new form instance so contexts and hooks remount.
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
	 * Keep this instance for the mounted field's lifetime. To replace it, key the
	 * enclosing field subtree by the new form instance, including its parent scope.
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
		 * Keep this instance for the mounted fieldset's lifetime. To replace it, key
		 * the entire fieldset subtree by the new form instance.
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
				fieldErrorsLive?: FieldErrorsLive;
		  }
	);

export type FieldsetProps<
	T extends Record<string, unknown>,
	U extends FormPath<T>,
	M = any,
> = FieldsetPropsWithoutHTML<T, U, M> &
	Without<PrimitiveFieldSetAttributes, FieldsetPropsWithoutHTML<T, U, M>>;
