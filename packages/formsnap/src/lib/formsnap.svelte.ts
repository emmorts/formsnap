import { type Getter, type ReadableBoxedValues } from "svelte-toolbelt";
import { fromStore } from "svelte/store";
import type { FormPath, FormPathLeaves, InputConstraints } from "sveltekit-superforms";
import type { FormPathArrays, TaintedFields, ValidationErrors } from "sveltekit-superforms/client";
import { setContext } from "svelte";
import { extractErrorArray } from "./internal/utils/errors.js";
import { getValueAtPath } from "./internal/utils/path.js";
import { getRequiredContext } from "./internal/context.js";
import {
	AssociationIds,
	FIELD_CONTEXT_PROVIDERS,
	FORM_FIELD_CTX,
	type PresentationField,
} from "./internal/presentation.svelte.js";
import type { FsSuperForm } from "./components/types.js";
import type { FormPathValue } from "./internal/form-path.js";

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

type FieldState<
	T extends Record<string, unknown>,
	U extends AnyFormPath<T>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	M = any,
> = FormFieldState<T, U, M> | ElementFieldState<T, U, M>;

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

function getConstraintsAtPath(path: string, constraints: Record<string, unknown>) {
	const selected = getValueAtPath(path, constraints);
	// Snippet consumers may mutate their metadata without changing the Superforms store.
	return selected == null ? {} : structuredClone(selected);
}

/** Superforms taint trees count only `true` leaves, including selected groups and array items. */
function isSubtreeTainted(value: unknown): boolean {
	if (value === true) return true;
	if (value === null || typeof value !== "object") return false;
	for (const key in value) {
		if (
			Object.hasOwn(value, key) &&
			isSubtreeTainted((value as Record<string, unknown>)[key])
		) {
			return true;
		}
	}
	return false;
}

class FormFieldState<
	T extends Record<string, unknown>,
	U extends AnyFormPath<T>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	M = any,
> implements PresentationField {
	#name: FormFieldStateProps<T, U, M>["name"];
	#formErrors: SvelteBox<ValidationErrors<T>>;
	#formConstraints: SvelteBox<InputConstraints<T>>;
	#formTainted: SvelteBox<TaintedFields<T> | undefined>;
	#formData: SvelteBox<T>;
	form: FsSuperForm<T, M>;

	name = $derived.by(() => this.#name.current);
	// Superforms constraints describe the array item schema, without bracketed indices.
	#constraintsPath = $derived.by(() => {
		const name = this.#name.current;
		return Object.hasOwn(this.#formConstraints.current, name)
			? name
			: name.replace(/\[\d+\]/g, "");
	});
	errors = $derived.by(() =>
		extractErrorArray(getValueAtPath(this.#name.current, this.#formErrors.current))
	);
	constraints = $derived.by(() =>
		getConstraintsAtPath(this.#constraintsPath, this.#formConstraints.current)
	);
	tainted = $derived.by(() =>
		this.#formTainted.current
			? isSubtreeTainted(getValueAtPath(this.#name.current, this.#formTainted.current))
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

	constructor(props: FormFieldStateProps<T, U, M>) {
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
				value: getValueAtPath(this.#name.current, this.#formData.current) as FormPathValue<
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

class ElementFieldState<
	T extends Record<string, unknown>,
	U extends AnyFormPath<T>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	M = any,
> implements PresentationField {
	#name: ElementFieldStateProps<T, U, M>["name"];
	#formErrors: SvelteBox<ValidationErrors<T>>;
	#formConstraints: SvelteBox<InputConstraints<T>>;
	#formTainted: SvelteBox<TaintedFields<T> | undefined>;
	#formData: SvelteBox<T>;
	#field: PresentationField;
	form: FsSuperForm<T, M>;
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
	constraints = $derived.by(() =>
		getConstraintsAtPath(this.#constraintsPath, this.#formConstraints.current)
	);
	tainted = $derived.by(() =>
		this.#formTainted.current
			? isSubtreeTainted(getValueAtPath(this.#name.current, this.#formTainted.current))
			: false
	);
	/** Owned declarations and additional mounted contributors for this element. */
	associations: AssociationIds;
	value = $derived.by(() => {
		return getValueAtPath(this.#name.current, this.#formData.current) as FormPathValue<T, U>;
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

	constructor(props: ElementFieldStateProps<T, U, M>, field: PresentationField) {
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

export function useField<
	T extends Record<string, unknown>,
	U extends AnyFormPath<T>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	M = any,
>(props: FormFieldStateProps<T, U, M>) {
	return setContext(FORM_FIELD_CTX, new FormFieldState(props));
}

export function useElementField<
	T extends Record<string, unknown>,
	U extends AnyFormPath<T>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	M = any,
>(props: ElementFieldStateProps<T, U, M>) {
	const formField = getField<T, U, M>();
	return setContext(FORM_FIELD_CTX, new ElementFieldState(props, formField));
}

export function getField<
	T extends Record<string, unknown> = Record<string, unknown>,
	U extends AnyFormPath<T> = FormPath<T>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	M = any,
>() {
	return getRequiredContext<FieldState<T, U, M>>(FORM_FIELD_CTX, FIELD_CONTEXT_PROVIDERS);
}

// takes a string like "urls[0]" and returns ["urls", "0"]
// so we can access the specific array index properties
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

/** Headless field state. The form and its message remain owned by Superforms. */
export type UseFormFieldResult<
	T extends Record<string, unknown> = Record<string, unknown>,
	U extends AnyFormPath<T> = FormPath<T>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	M = any,
> = {
	form: FsSuperForm<T, M>;
	readonly name: U;
	readonly errors: string[];
	readonly constraints: Record<string, unknown>;
	readonly tainted: boolean;
	readonly errorsId: string | undefined;
	readonly descriptionId: string | undefined;
};

export function useFormField<
	T extends Record<string, unknown> = Record<string, unknown>,
	U extends AnyFormPath<T> = FormPath<T>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	M = any,
>(props: UseFormFieldProps): UseFormFieldResult<T, U, M> {
	const fieldState = getField<T, U, M>();
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

/**
 * Use `useFormField` instead.
 * @deprecated
 */
export const getFormField = useFormField;
