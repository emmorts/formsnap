import {
	type Getter,
	type ReadableBoxedValues,
	type WithRefProps,
	useRefById,
} from "svelte-toolbelt";
import { fromStore } from "svelte/store";
import type {
	FormPath,
	FormPathLeaves,
	FormPathType,
	InputConstraints,
} from "sveltekit-superforms";
import type { FormPathArrays, TaintedFields, ValidationErrors } from "sveltekit-superforms/client";
import { createAttachmentKey, type Attachment } from "svelte/attachments";
import { getContext, onDestroy, setContext, untrack } from "svelte";
import { extractErrorArray } from "./internal/utils/errors.js";
import { getValueAtPath } from "./internal/utils/path.js";
import {
	getAriaDescribedBy,
	getAriaInvalid,
	getAriaRequired,
	getDataFsError,
	getDescriptionProps,
	getErrorProps,
	getFieldErrorsProps,
} from "./internal/utils/attributes.js";
import type { ControlAttrs, FieldErrorsLive, LabelAttrs } from "./attrs.types.js";
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
	descriptionId?: string;
	fieldErrorsId?: string;
}>;

type OwnedAssociationProps = Pick<
	FormFieldStateProps<Record<string, unknown>, string>,
	"descriptionId" | "fieldErrorsId"
>;

/**
 * Description and error registrations belong to their contributors, not to their id strings.
 * Several owners can describe the same element; releasing one owner must leave the others intact.
 */
class AssociationIds {
	#owned: OwnedAssociationProps;
	#descriptions = $state<{ owner: symbol; id: string }[]>([]);
	#errors = $state<{ owner: symbol; id: string }[]>([]);
	#descriptionIds = $derived.by(() => {
		const ownedId = this.#owned.descriptionId?.current;
		const mountedIds = this.#descriptions.map(({ id }) => id);
		return [...new Set(ownedId === undefined ? mountedIds : [ownedId, ...mountedIds])];
	});
	#errorIds = $derived.by(() => {
		const ownedId = this.#owned.fieldErrorsId?.current;
		const mountedIds = this.#errors.map(({ id }) => id);
		return [...new Set(ownedId === undefined ? mountedIds : [ownedId, ...mountedIds])];
	});

	constructor(owned: OwnedAssociationProps) {
		this.#owned = owned;
	}

	get descriptionIds() {
		return this.#descriptionIds;
	}

	get errorIds() {
		return this.#errorIds;
	}

	addDescription(id: string) {
		const owner = Symbol();
		untrack(() => {
			this.#descriptions = [...this.#descriptions, { owner, id }];
		});
		return () => {
			untrack(() => {
				this.#descriptions = this.#descriptions.filter((entry) => entry.owner !== owner);
			});
		};
	}

	addErrors(id: string) {
		const owner = Symbol();
		untrack(() => {
			this.#errors = [...this.#errors, { owner, id }];
		});
		return () => {
			untrack(() => {
				this.#errors = this.#errors.filter((entry) => entry.owner !== owner);
			});
		};
	}
}

type AssociationAttachment = Record<symbol, Attachment<HTMLElement>>;

/** Only a node receiving the spread props can contribute an association or receive the ref. */
function useAssociationRef(
	props: WithRefProps,
	register: (id: string) => () => void
): AssociationAttachment {
	let node = $state<HTMLElement | null>(null);
	const attachment: AssociationAttachment = {
		[createAttachmentKey()]: (element: HTMLElement) => {
			node = element;
			props.ref.current = element;
			return () => {
				node = null;
				props.ref.current = null;
			};
		},
	};

	$effect(() => {
		const id = props.id.current;
		if (!id || !node || node.id !== id) return;
		return register(id);
	});

	return attachment;
}

class FormFieldState<T extends Record<string, unknown>, U extends AnyFormPath<T>> {
	#name: FormFieldStateProps<T, U>["name"];
	#formErrors: SvelteBox<ValidationErrors<T>>;
	#formConstraints: SvelteBox<InputConstraints<T>>;
	#formTainted: SvelteBox<TaintedFields<T> | undefined>;
	#formData: SvelteBox<T>;
	form: FsSuperForm<T>;

	name = $derived.by(() => this.#name.current);
	// Superforms constraints describe the array item schema, without bracketed indices.
	#constraintsPath = $derived.by(() => {
		const name = this.#name.current;
		return Object.hasOwn(this.#formConstraints.current, name)
			? name
			: name.replace(/\[\d+\]/g, "");
	});
	errors = $derived.by(() =>
		extractErrorArray(
			getValueAtPath(this.#name.current, structuredClone(this.#formErrors.current))
		)
	);
	constraints = $derived.by(
		() =>
			getValueAtPath(this.#constraintsPath, structuredClone(this.#formConstraints.current)) ??
			{}
	);
	tainted = $derived.by(() =>
		this.#formTainted.current
			? getValueAtPath(this.#name.current, structuredClone(this.#formTainted.current)) ===
				true
			: false
	);
	/** Owned declarations and additional mounted contributors for this field. */
	associations: AssociationIds;

	/** Distinct description ids, with the owned target first. */
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
		this.associations = new AssociationIds(props);
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
				value: getValueAtPath(this.#name.current, this.#formData.current) as FormPathType<
					T,
					U
				>,
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
	descriptionId?: string;
	fieldErrorsId?: string;
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
	#constraintsPath = $derived.by(() => {
		const name = this.#name.current;
		return Object.hasOwn(this.#formConstraints.current, name)
			? name
			: name.replace(/\[\d+\]/g, "");
	});
	errors = $derived.by(() =>
		extractErrorArray(getValueAtPath(this.#name.current, this.#formErrors.current))
	);
	constraints = $derived.by(
		() => getValueAtPath(this.#constraintsPath, this.#formConstraints.current) ?? {}
	);
	tainted = $derived.by(() =>
		this.#formTainted.current
			? getValueAtPath(this.#name.current, this.#formTainted.current) === true
			: false
	);
	/** Owned declarations and additional mounted contributors for this element. */
	associations: AssociationIds;
	value = $derived.by(() => {
		return getValueAtPath(this.#name.current, this.#formData.current) as FormPathType<T, U>;
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
		this.associations = new AssociationIds(props);
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
				value: this.value,
				errors: this.errors,
				tainted: this.tainted,
				constraints: this.constraints,
			}) as const
	);
}

type FieldErrorsStateProps = WithRefProps<{ live?: FieldErrorsLive }>;

class FieldErrorsState<T extends Record<string, unknown>, U extends AnyFormPath<T>> {
	#attachment: AssociationAttachment;
	#id: FieldErrorsStateProps["id"];
	#live: FieldErrorsStateProps["live"];
	field: FieldState<T, U>;

	constructor(props: FieldErrorsStateProps, field: FieldState<T, U>) {
		this.#attachment = useAssociationRef(props, (id) => field.associations.addErrors(id));
		this.#id = props.id;
		this.#live = props.live;
		this.field = field;
	}

	snippetProps = $derived.by(() => ({
		errors: this.field.errors,
		errorProps: this.errorProps,
	}));

	fieldErrorsProps = $derived.by(() => ({
		...getFieldErrorsProps(
			this.#id.current,
			this.field.errors,
			this.#live.current ?? "assertive"
		),
		...this.#attachment,
	}));

	errorProps = $derived.by(() => getErrorProps(this.field.errors));
}

type DescriptionStateProps = WithRefProps;

class DescriptionState {
	#attachment: AssociationAttachment;
	#id: DescriptionStateProps["id"];
	field: FieldState<Record<string, unknown>, string>;

	constructor(props: DescriptionStateProps, field: FieldState<Record<string, unknown>, string>) {
		this.#attachment = useAssociationRef(props, (id) => field.associations.addDescription(id));
		this.#id = props.id;
		this.field = field;
	}

	props = $derived.by(() => ({
		...getDescriptionProps(this.#id.current, this.field.errors),
		...this.#attachment,
	}));
}

type ControlStateProps = ReadableBoxedValues<{
	id: string;
	labelId: string;
}>;

class ControlState {
	#id: ControlStateProps["id"];
	/** Owner-scoped headless getters, resolved synchronously with the control's props. */
	#overrides = $state<{ owner: symbol; id: Getter<string | null | undefined> }[]>([]);
	field: FieldState<Record<string, unknown>, string>;
	/** Id used when the consumer spreads `labelProps` without rendering a `Label` to override it. */
	labelId: ControlStateProps["id"];

	/**
	 * The control's id. It is the id the component resolved, which a consumer-supplied id replaces
	 * synchronously and which is therefore part of the first server-rendered markup, unless
	 * `useFormControl` overrides it.
	 */
	get id(): string {
		for (let index = this.#overrides.length - 1; index >= 0; index--) {
			const id = this.#overrides[index].id();
			if (id != null) return id;
		}
		return this.#id.current;
	}

	constructor(props: ControlStateProps, field: FieldState<Record<string, unknown>, string>) {
		this.#id = props.id;
		this.labelId = props.labelId;
		this.field = field;
	}

	/** The most recently registered non-null headless id wins until its owner releases it. */
	addId(id: Getter<string | null | undefined>) {
		const owner = Symbol();
		untrack(() => {
			this.#overrides = [...this.#overrides, { owner, id }];
		});
		return () => {
			untrack(() => {
				this.#overrides = this.#overrides.filter((entry) => entry.owner !== owner);
			});
		};
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
	$effect(() => {
		const id = props.errorsId?.();
		if (id) return fieldState.associations.addErrors(id);
	});

	$effect(() => {
		const id = props.descriptionId?.();
		if (id) return fieldState.associations.addDescription(id);
	});

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
	if (props.id) onDestroy(controlState.addId(props.id));

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
