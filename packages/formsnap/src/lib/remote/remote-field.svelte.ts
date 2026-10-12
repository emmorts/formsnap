import { setContext } from "svelte";
import type { Getter } from "svelte-toolbelt";
import { getRequiredContext } from "$lib/internal/context.js";
import {
	AssociationIds,
	FORM_FIELD_CTX,
	type PresentationField,
} from "$lib/internal/presentation.svelte.js";
import type { RemoteFieldLike, RemoteIssue, RemoteFieldValue } from "./types.js";

/** Reads the selected field, which is why a fresh Kit proxy per read is harmless. */
export type RemoteFieldBox<F extends RemoteFieldLike> = {
	current: F;
};

export type RemoteFieldStateProps<F extends RemoteFieldLike> = {
	field: RemoteFieldBox<F>;
	constraints: { current: Record<string, unknown> };
	descriptionId?: { current: string | undefined };
	fieldErrorsId?: { current: string | undefined };
};

/**
 * Presentation state for one selected Kit remote field.
 *
 * It satisfies `PresentationField` without pretending to be a Superforms field: there is no form, no
 * captured store, and no `name` — Kit owns the control's transport name and its invalid state
 * together. Every read comes from the selected field, so nothing here inspects the whole form or
 * enumerates a schema. The reads sit in deriveds, and Kit backs issues, touched and dirty with
 * reactive state, so a validation result or a programmatic update re-renders the presentation.
 */
export class RemoteFieldState<F extends RemoteFieldLike> implements PresentationField {
	#field: RemoteFieldBox<F>;
	#constraints: RemoteFieldStateProps<F>["constraints"];

	/** Owned declarations and additional mounted contributors for this field. */
	associations: AssociationIds;

	/** Absent issues mean "nothing to announce", which is not the same as validated success. */
	errors = $derived.by(() => this.issues?.map((issue) => issue.message) ?? []);

	/** Kit's issues unnormalized, so a caller keeps the structured path a summary needs. */
	issues = $derived.by<RemoteIssue[] | undefined>(() => this.#field.current.issues());

	/** Explicit constraints. Kit's `as(...)` derives none, so this is only what a caller passed. */
	constraints = $derived.by(() => this.#constraints.current);

	/** Whether this field or anything below it has been interacted with. Not Superforms taint. */
	touched = $derived.by(() => this.#field.current.touched());

	/** Whether this field or anything below it has been edited. Not Superforms taint. */
	dirty = $derived.by(() => this.#field.current.dirty());

	/** The selected subtree's value, read only when a snippet actually needs it. */
	value = $derived.by<RemoteFieldValue<F>>(
		() => this.#field.current.value() as RemoteFieldValue<F>
	);

	/** The selected Kit field itself, with the caller's own type. */
	get field(): F {
		return this.#field.current;
	}

	get descriptionIds(): string[] {
		return this.associations.descriptionIds;
	}

	get errorIds(): string[] {
		return this.associations.errorIds;
	}

	get descriptionId(): string | undefined {
		return this.descriptionIds[0];
	}

	get errorId(): string | undefined {
		return this.errorIds[0];
	}

	constructor(props: RemoteFieldStateProps<F>) {
		this.#field = props.field;
		this.#constraints = props.constraints;
		this.associations = new AssociationIds(props);
	}

	snippetProps = $derived.by(
		() =>
			({
				value: this.value,
				issues: this.issues,
				errors: this.errors,
				touched: this.touched,
				dirty: this.dirty,
				constraints: this.constraints,
			}) as const
	);
}

/**
 * Installs a remote field scope. The presentation components below it — `RemoteControl`, `Label`,
 * `Description`, `FieldErrors`, `Legend` — read it exactly as they read a Superforms field.
 */
export function useRemoteField<F extends RemoteFieldLike>(props: RemoteFieldStateProps<F>) {
	return setContext(FORM_FIELD_CTX, new RemoteFieldState(props));
}

/**
 * Reads the selected remote field state. The generic is the caller's own field type, since Kit does
 * not export the `RemoteForm*` types to import instead.
 */
export function getRemoteField<F extends RemoteFieldLike>(): RemoteFieldState<F> {
	return getRequiredContext<RemoteFieldState<F>>(FORM_FIELD_CTX, "RemoteField");
}

export type UseRemoteFieldViewProps = {
	/** Optionally declare the ID of your own error container. */
	errorsId?: Getter<string | undefined | null>;
	/** Optionally declare the ID of your own description element. */
	descriptionId?: Getter<string | undefined | null>;
};

export type UseRemoteFieldViewResult<F extends RemoteFieldLike> = {
	/** The selected Kit field, original and fully typed. */
	readonly field: F;
	readonly issues: RemoteIssue[] | undefined;
	readonly errors: string[];
	/** Kit's own state, reported as itself. Never presented as Superforms taint. */
	readonly touched: boolean;
	readonly dirty: boolean;
	readonly constraints: Record<string, unknown>;
	readonly errorsId: string | undefined;
	readonly descriptionId: string | undefined;
};

/**
 * Headless access to the selected remote field for a control that lives in its own component. It
 * returns the Kit field plus presentation state, and invents no Superforms method.
 */
export function useRemoteFormField<F extends RemoteFieldLike>(
	props: UseRemoteFieldViewProps = {}
): UseRemoteFieldViewResult<F> {
	const state = getRemoteField<F>();

	$effect(() => {
		const id = props.errorsId?.();
		if (id) return state.associations.addErrors(id);
	});

	$effect(() => {
		const id = props.descriptionId?.();
		if (id) return state.associations.addDescription(id);
	});

	return {
		get field() {
			return state.field;
		},
		get issues() {
			return state.issues;
		},
		get errors() {
			return state.errors;
		},
		get touched() {
			return state.touched;
		},
		get dirty() {
			return state.dirty;
		},
		get constraints() {
			return state.constraints;
		},
		get errorsId() {
			return state.errorId;
		},
		get descriptionId() {
			return state.descriptionId;
		},
	};
}
