import {
	type Getter,
	type ReadableBoxedValues,
	type WithRefProps,
	useOnChange,
	useRefById,
} from "svelte-toolbelt";
import { fromStore } from "svelte/store";
import type {
	FormPath,
	FormPathLeaves,
	InputConstraint,
	InputConstraints,
} from "sveltekit-superforms";
import type { FormPathArrays, TaintedFields, ValidationErrors } from "sveltekit-superforms/client";
import { getContext, setContext } from "svelte";
import { extractErrorArray } from "./internal/utils/errors.js";
import { getValueAtPath } from "./internal/utils/path.js";
import {
	getAriaDescribedBy,
	getAriaInvalid,
	getAriaRequired,
	getDataFsError,
} from "./internal/utils/attributes.js";
import type { PrimitiveFromIndex } from "./internal/types.js";
import type {
	ControlAttrs,
	DescriptionAttrs,
	ErrorAttrs,
	FieldErrorsAttrs,
	LabelAttrs,
} from "./attrs.types.js";
import type { FsSuperForm } from "./components/types.js";

/**
 * superforms 3 declares `FormPath<T>` and `FormPathLeaves<T>` as separate conditional string
 * types, so a leaf path is no longer assignable to the wider `FormPath<T>` even though both
 * describe the same runtime strings. The internal generics are constrained on the union of the
 * two; the public component props keep using the narrower types they always had.
 */
type AnyFormPath<T extends Record<string, unknown>> = FormPath<T> | FormPathLeaves<T>;

type SvelteBox<T> = {
	current: T;
};

type FieldState<T extends Record<string, unknown>, U extends AnyFormPath<T>> =
	| FormFieldState<T, U>
	| ElementFieldState<T, U>;

type FormFieldStateProps<
	T extends Record<string, unknown>,
	U extends AnyFormPath<T>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	M = any,
> = ReadableBoxedValues<{
	form: FsSuperForm<T, M>;
	name: U;
}>;

/**
 * The description elements and error containers that are currently rendered inside one field.
 *
 * Every contributor registers the id it actually rendered and withdraws it when that element goes
 * away, so one description unmounting cannot remove another's association, and a reference is never
 * left pointing at an element that is no longer there.
 */
class AssociationIds {
	#descriptionIds = $state<string[]>([]);
	#errorIds = $state<string[]>([]);

	/** Description elements, in document order. */
	get descriptionIds() {
		return this.#descriptionIds;
	}

	/** Error containers, in document order. */
	get errorIds() {
		return this.#errorIds;
	}

	addDescription(id: string) {
		if (this.#descriptionIds.includes(id)) return;
		this.#descriptionIds = [...this.#descriptionIds, id];
	}

	removeDescription(id: string) {
		this.#descriptionIds = this.#descriptionIds.filter((existing) => existing !== id);
	}

	addErrors(id: string) {
		if (this.#errorIds.includes(id)) return;
		this.#errorIds = [...this.#errorIds, id];
	}

	removeErrors(id: string) {
		this.#errorIds = this.#errorIds.filter((existing) => existing !== id);
	}
}

class FormFieldState<T extends Record<string, unknown>, U extends AnyFormPath<T>> {
	#name: FormFieldStateProps<T, U>["name"];
	#formErrors: SvelteBox<ValidationErrors<T>>;
	#formConstraints: SvelteBox<InputConstraints<T>>;
	#formTainted: SvelteBox<TaintedFields<T> | undefined>;
	#formData: SvelteBox<T>;
	form: FsSuperForm<T>;

	name = $derived.by(() => this.#name.current);
	errors = $derived.by(() =>
		extractErrorArray(
			getValueAtPath(this.#name.current, structuredClone(this.#formErrors.current))
		)
	);
	constraints = $derived.by(
		() =>
			getValueAtPath(this.#name.current, structuredClone(this.#formConstraints.current)) ?? {}
	);
	tainted = $derived.by(() =>
		this.#formTainted.current
			? getValueAtPath(this.#name.current, structuredClone(this.#formTainted.current)) ===
				true
			: false
	);
	/** Description elements and error containers currently rendered inside this field. */
	associations = new AssociationIds();

	/** The ids the control has to describe itself with, in document order. */
	get descriptionIds() {
		return this.associations.descriptionIds;
	}

	get errorIds() {
		return this.associations.errorIds;
	}

	/** The first description, which is what a headless consumer points at. */
	get descriptionId() {
		return this.descriptionIds[0];
	}

	/** The first error container, which is what a headless consumer points at. */
	get errorId() {
		return this.errorIds[0];
	}

	constructor(props: FormFieldStateProps<T, U>) {
		this.#name = props.name;
		this.form = props.form.current;
		this.#formErrors = fromStore(props.form.current.errors);
		this.#formConstraints = fromStore(props.form.current.constraints);
		this.#formTainted = fromStore(props.form.current.tainted);
		this.#formData = fromStore(props.form.current.form);
	}

	snippetProps = $derived.by(
		() =>
			({
				value: this.#formData.current[this.#name.current],
				errors: this.errors,
				tainted: this.tainted,
				constraints: this.constraints,
			}) as const
	);
}

type ElementFieldStateProps<
	T extends Record<string, unknown>,
	U extends AnyFormPath<T>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	M = any,
> = ReadableBoxedValues<{
	form: FsSuperForm<T, M>;
	name: U;
}>;

class ElementFieldState<T extends Record<string, unknown>, U extends AnyFormPath<T>> {
	#name: ElementFieldStateProps<T, U>["name"];
	#formErrors: SvelteBox<ValidationErrors<T>>;
	#formConstraints: SvelteBox<InputConstraints<T>>;
	#formTainted: SvelteBox<TaintedFields<T> | undefined>;
	#formData: SvelteBox<T>;
	#field: FieldState<T, U>;
	form: FsSuperForm<T>;
	name = $derived.by(() => {
		const [path] = splitArrayPath<T>(this.#name.current);
		return path as U;
	});
	errors = $derived.by(() =>
		extractErrorArray(getValueAtPath(this.#name.current, this.#formErrors.current))
	);
	constraints = $derived.by(
		() => getValueAtPath(this.#name.current, this.#formConstraints.current) ?? {}
	);
	tainted = $derived.by(() =>
		this.#formTainted.current
			? getValueAtPath(this.#name.current, this.#formTainted.current) === true
			: false
	);
	/** Description elements and error containers rendered inside this element. */
	associations = new AssociationIds();
	value = $derived.by(() => {
		return getValueAtPath(this.#name.current, this.#formData.current) as PrimitiveFromIndex<
			T,
			U
		>;
	});

	/**
	 * An element that renders a description of its own uses that one; otherwise it inherits the
	 * descriptions of the field it belongs to.
	 */
	get descriptionIds(): string[] {
		return this.associations.descriptionIds.length
			? this.associations.descriptionIds
			: this.#field.descriptionIds;
	}

	get errorIds(): string[] {
		return this.associations.errorIds;
	}

	/** The first description, which is what a headless consumer points at. */
	get descriptionId() {
		return this.descriptionIds[0];
	}

	/** The first error container, which is what a headless consumer points at. */
	get errorId() {
		return this.errorIds[0];
	}

	constructor(props: ElementFieldStateProps<T, U>, field: FieldState<T, U>) {
		this.#name = props.name;
		this.form = props.form.current;
		this.#formErrors = fromStore(props.form.current.errors);
		this.#formConstraints = fromStore(props.form.current.constraints);
		this.#formTainted = fromStore(props.form.current.tainted);
		this.#formData = fromStore(props.form.current.form);
		this.#field = field;
	}

	snippetProps = $derived.by(
		() =>
			({
				value: this.#formData.current[this.#name.current],
				errors: this.errors,
				tainted: this.tainted,
				constraints:
					// @ts-expect-error - this type is wonky
					this.#formConstraints.current[this.#name.current] ?? ({} as InputConstraint),
			}) as const
	);
}

type FieldErrorsStateProps = WithRefProps;

class FieldErrorsState<T extends Record<string, unknown>, U extends AnyFormPath<T>> {
	#ref: FieldErrorsStateProps["ref"];
	#id: FieldErrorsStateProps["id"];
	field: FieldState<T, U>;
	#errorAttr = $derived.by(() => getDataFsError(this.field.errors));

	constructor(props: FieldErrorsStateProps, field: FieldState<T, U>) {
		this.#ref = props.ref;
		this.#id = props.id;
		this.field = field;

		/** The id this container contributed, so unmounting withdraws only its own registration. */
		let registeredId: string | undefined;

		useRefById({
			id: this.#id,
			ref: this.#ref,
			onRefChange: (node) => {
				if (registeredId) this.field.associations.removeErrors(registeredId);
				registeredId = node?.id || undefined;
				if (registeredId) this.field.associations.addErrors(registeredId);
			},
		});
	}

	snippetProps = $derived.by(() => ({
		errors: this.field.errors,
		errorProps: this.errorProps,
	}));

	fieldErrorsProps = $derived.by(
		() =>
			({
				id: this.#id.current,
				"data-fs-error": this.#errorAttr,
				"data-fs-field-errors": "",
				"aria-live": "assertive",
			}) satisfies FieldErrorsAttrs
	);

	errorProps = $derived.by(
		() =>
			({
				"data-fs-field-error": "",
				"data-fs-error": this.#errorAttr,
			}) satisfies ErrorAttrs
	);
}

type DescriptionStateProps = WithRefProps;

class DescriptionState {
	#ref: DescriptionStateProps["ref"];
	#id: DescriptionStateProps["id"];
	field: FieldState<Record<string, unknown>, string>;

	constructor(props: DescriptionStateProps, field: FieldState<Record<string, unknown>, string>) {
		this.#ref = props.ref;
		this.#id = props.id;
		this.field = field;

		/** The id this description contributed, so unmounting withdraws only its own registration. */
		let registeredId: string | undefined;

		useRefById({
			id: this.#id,
			ref: this.#ref,
			onRefChange: (node) => {
				if (registeredId) this.field.associations.removeDescription(registeredId);
				registeredId = node?.id || undefined;
				if (registeredId) this.field.associations.addDescription(registeredId);
			},
		});
	}

	props = $derived.by(
		() =>
			({
				id: this.#id.current,
				"data-fs-error": getDataFsError(this.field.errors),
				"data-fs-description": "",
			}) satisfies DescriptionAttrs
	);
}

type ControlStateProps = ReadableBoxedValues<{
	id: string;
	labelId: string;
}>;

class ControlState {
	#id: ControlStateProps["id"];
	/** An id a headless consumer asked for; it wins until the consumer clears it. */
	#override = $state<string | null>(null);
	field: FieldState<Record<string, unknown>, string>;
	/** Id used when the consumer spreads `labelProps` without rendering a `Label` to override it. */
	labelId: ControlStateProps["id"];

	/**
	 * The control's id. It is the id the component resolved, which a consumer-supplied id replaces
	 * synchronously and which is therefore part of the first server-rendered markup, unless
	 * `useFormControl` overrides it.
	 */
	get id(): string {
		return this.#override ?? this.#id.current;
	}

	constructor(props: ControlStateProps, field: FieldState<Record<string, unknown>, string>) {
		this.#id = props.id;
		this.labelId = props.labelId;
		this.field = field;
	}

	/** Sets the id a headless consumer wants the control to use, or clears it to use the prop id. */
	setId(id: string | null | undefined) {
		this.#override = id ?? null;
	}

	props = $derived.by(
		() =>
			({
				id: this.id,
				name: this.field.name,
				"data-fs-error": getDataFsError(this.field.errors),
				"aria-describedby": getAriaDescribedBy({
					errorIds: this.field.errorIds,
					descriptionIds: this.field.descriptionIds,
					errors: this.field.errors,
				}),
				"aria-invalid": getAriaInvalid(this.field.errors),
				"aria-required": getAriaRequired(this.field.constraints),
				"data-fs-control": "",
			}) satisfies ControlAttrs
	);

	labelProps = $derived.by(
		() =>
			({
				id: this.labelId.current,
				"data-fs-label": "",
				"data-fs-error": getDataFsError(this.field.errors),
				for: this.id,
			}) satisfies LabelAttrs
	);
}

type LabelStateProps = WithRefProps;

class LabelState {
	#ref: LabelStateProps["ref"];
	#id: LabelStateProps["id"];
	control: ControlState;

	constructor(props: LabelStateProps, control: ControlState) {
		this.#ref = props.ref;
		this.#id = props.id;
		this.control = control;
		this.control.labelId = this.#id;

		useRefById({
			id: this.#id,
			ref: this.#ref,
		});
	}

	get props() {
		return this.control.labelProps;
	}
}

type LegendStateProps = WithRefProps;

class LegendState {
	#ref: LegendStateProps["ref"];
	#id: LegendStateProps["id"];
	field: FieldState<Record<string, unknown>, string>;

	constructor(props: LegendStateProps, field: FieldState<Record<string, unknown>, string>) {
		this.#ref = props.ref;
		this.#id = props.id;
		this.field = field;

		useRefById({
			id: this.#id,
			ref: this.#ref,
		});
	}

	props = $derived.by(
		() =>
			({
				id: this.#id.current,
				"data-fs-error": getDataFsError(this.field.errors),
				"data-fs-legend": "",
			}) as const
	);
}

const FORM_FIELD_CTX = Symbol.for("formsnap.form-field");
const FORM_CONTROL_CTX = Symbol.for("formsnap.form-control");

export function useField<T extends Record<string, unknown>, U extends AnyFormPath<T>>(
	props: FormFieldStateProps<T, U>
) {
	return setContext(FORM_FIELD_CTX, new FormFieldState(props));
}

export function useElementField<T extends Record<string, unknown>, U extends AnyFormPath<T>>(
	props: ElementFieldStateProps<T, U>
) {
	const formField = getField<T, U>();
	return setContext(FORM_FIELD_CTX, new ElementFieldState(props, formField));
}

export function getField<
	T extends Record<string, unknown> = Record<string, unknown>,
	U extends AnyFormPath<T> = FormPath<T>,
>() {
	return getContext<FieldState<T, U>>(FORM_FIELD_CTX);
}

export function useFieldErrors<
	T extends Record<string, unknown> = Record<string, unknown>,
	U extends AnyFormPath<T> = FormPath<T>,
>(props: FieldErrorsStateProps) {
	return new FieldErrorsState(props, getField<T, U>());
}

export function useDescription(props: DescriptionStateProps) {
	return new DescriptionState(props, getField());
}

export function useControl(props: ControlStateProps) {
	return setContext(FORM_CONTROL_CTX, new ControlState(props, getField()));
}

export function _getFormControl() {
	return getContext<ControlState>(FORM_CONTROL_CTX);
}

export function useLabel(props: LabelStateProps) {
	return new LabelState(props, _getFormControl());
}

export function useLegend(props: LegendStateProps) {
	return new LegendState(props, getField());
}

// takes a string like "urls[0]" and returns ["urls", "0"]
// so we can access the specific array index properties
// since datatype: json is not supported with regular form
// submission, this should be fine
function splitArrayPath<T extends Record<string, unknown>>(name: string) {
	const [path, index] = name.split(/[[\]]/);
	return [path, index] as [FormPathArrays<T>, string];
}

export type UseFormFieldProps = {
	/** Optionally provide a function that returns the ID of the field errors container. */
	errorsId?: Getter<string | undefined | null>;
	/** Optionally provide a function that returns the ID of the description element. */
	descriptionId?: Getter<string | undefined | null>;
};

export function useFormField<
	T extends Record<string, unknown> = Record<string, unknown>,
	U extends AnyFormPath<T> = FormPath<T>,
>(props: UseFormFieldProps) {
	const fieldState = getContext<FieldState<T, U>>(FORM_FIELD_CTX);
	const form = fieldState.form;
	const errorsId = $derived(props.errorsId ? props.errorsId() : undefined);
	const descriptionId = $derived(props.descriptionId ? props.descriptionId() : undefined);

	/** What this hook contributed, so a change withdraws the previous id and a null releases it. */
	let contributedErrors: string | undefined;
	let contributedDescription: string | undefined;

	useOnChange(
		() => errorsId,
		(v) => {
			if (contributedErrors) fieldState.associations.removeErrors(contributedErrors);
			contributedErrors = v ?? undefined;
			if (contributedErrors) fieldState.associations.addErrors(contributedErrors);
		}
	);

	useOnChange(
		() => descriptionId,
		(v) => {
			if (contributedDescription) {
				fieldState.associations.removeDescription(contributedDescription);
			}
			contributedDescription = v ?? undefined;
			if (contributedDescription)
				fieldState.associations.addDescription(contributedDescription);
		}
	);

	return {
		form,
		get name() {
			return fieldState.name;
		},
		get errors() {
			return fieldState.errors;
		},
		get constraints() {
			return fieldState.constraints;
		},
		get tainted() {
			return fieldState.tainted;
		},
		get errorsId() {
			return fieldState.errorId;
		},
		get descriptionId() {
			return fieldState.descriptionId;
		},
	};
}

export type UseFormControlProps = {
	/** Optionally provide a function that returns the ID of the control element. */
	id?: Getter<string | undefined | null>;
};

export function useFormControl(props: UseFormControlProps) {
	const controlState = getContext<ControlState>(FORM_CONTROL_CTX);
	const id = $derived(props.id ? props.id() : undefined);

	useOnChange(
		() => id,
		(v) => {
			controlState.setId(v);
		}
	);

	return {
		get id() {
			return controlState.id;
		},
		get labelProps() {
			return controlState.labelProps;
		},
		get props() {
			return controlState.props;
		},
	};
}

/**
 * Use `useFormControl` instead.
 * @deprecated
 */
export const getFormControl = useFormControl;

/**
 * Use `useFormField` instead.
 * @deprecated
 */
export const getFormField = useFormField;
