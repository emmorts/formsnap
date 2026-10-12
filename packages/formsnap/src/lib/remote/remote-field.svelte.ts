import { setContext } from "svelte";
import type { Getter } from "svelte-toolbelt";
import { getRequiredContext } from "$lib/internal/context.js";
import {
	AssociationIds,
	FORM_FIELD_CTX,
	type PresentationField,
} from "$lib/internal/presentation.svelte.js";
import type {
	RemoteFieldLike,
	RemoteIssue,
	RemoteFieldValue,
	RemoteFieldSnippetProps,
} from "./types.js";

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

/** Presentation state for the selected field; Kit retains ownership of its values and issues. */
export class RemoteFieldState<F extends RemoteFieldLike> implements PresentationField {
	#field: RemoteFieldBox<F>;
	#constraints: RemoteFieldStateProps<F>["constraints"];

	/** Owned declarations and additional mounted contributors for this field. */
	associations: AssociationIds;

	/** Absent issues mean "nothing to announce", which is not the same as validated success. */
	errors = $derived.by(() => this.issues?.map((issue) => issue.message) ?? []);

	// Detach mutable presentation metadata from Kit state and caller-owned constraints.
	issues = $derived.by<RemoteIssue[] | undefined>(() =>
		$state.snapshot(this.#field.current.issues())
	);

	constraints = $derived.by(() => $state.snapshot(this.#constraints.current));

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

	readonly snippetProps: Readonly<RemoteFieldSnippetProps<F>>;

	constructor(props: RemoteFieldStateProps<F>) {
		this.#field = props.field;
		this.#constraints = props.constraints;
		this.associations = new AssociationIds(props);
		// Stable getters keep unused values and interaction state lazy; the alias is the closed-over
		// instance those getters read.
		// eslint-disable-next-line @typescript-eslint/no-this-alias -- getters close over the instance
		const state = this;
		this.snippetProps = {
			get value() {
				return state.value;
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
		};
	}
}

/** Install a selected remote field scope for shared presentation components. */
export function useRemoteField<F extends RemoteFieldLike>(props: RemoteFieldStateProps<F>) {
	return setContext(FORM_FIELD_CTX, new RemoteFieldState(props));
}

/**
 * Reads the selected remote field state. The generic is the caller's own field type, since Kit does
 * not export the `RemoteForm*` types to import instead.
 */
export function getRemoteField<F extends RemoteFieldLike>(): RemoteFieldState<F> {
	const state = getRequiredContext<RemoteFieldState<F>>(
		FORM_FIELD_CTX,
		"RemoteField or RemoteFieldset"
	);
	if (!("field" in state)) {
		throw new Error(
			"Remote field hooks require RemoteField or RemoteFieldset. " +
				"Use useFormField from the root entry point inside a Superforms field."
		);
	}
	return state;
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

/** Read the enclosing remote scope without supplying a separate field prop. */
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
