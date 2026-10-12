import {
	type Getter,
	type ReadableBoxedValues,
	type WithRefProps,
	useRefById,
} from "svelte-toolbelt";
import { createAttachmentKey, type Attachment } from "svelte/attachments";
import { onDestroy, setContext, untrack } from "svelte";
import { getRequiredContext } from "./context.js";
import {
	getAriaDescribedBy,
	getAriaInvalid,
	getAriaRequired,
	getDataFsError,
	getDescriptionProps,
	getErrorProps,
	getFieldErrorsProps,
} from "./utils/attributes.js";
import type { ControlAttrs, FieldErrorsLive, LabelAttrs } from "../attrs.types.js";

/**
 * The presentation layer: association and control presentation, with no knowledge of where field
 * data comes from.
 *
 * Nothing here reads a Superforms store, and this module must not depend on `sveltekit-superforms`
 * — directly or through another module. A backend supplies a {@link PresentationField} for a scope;
 * `formsnap.svelte.ts` supplies the Superforms-backed one, and a native remote field supplies its own
 * without pretending to be a Superforms form. `tests/presentation-boundary.test.ts` asserts that
 * this module's import closure stays free of Superforms.
 */

/** What a field scope contributes to, so its own registrations can be released independently. */
export interface AssociationRegistry {
	addDescription(id: string): () => void;
	addErrors(id: string): () => void;
}

/**
 * The field scope presentation components read. Everything listed is presentation output: the
 * errors to announce, the constraints behind `aria-required`, and the ids other components have
 * declared.
 */
export interface PresentationField {
	/**
	 * The control's `name` attribute, when presentation owns naming. A transport that names its own
	 * controls — Kit's remote forms, where `as(...)` supplies the transport name together with the
	 * invalid state — omits this, and `Control` then contributes neither attribute. The two sources are
	 * disjoint by ownership rather than decided by spread order.
	 */
	readonly name?: string;
	readonly errors: string[];
	readonly constraints: Record<string, unknown>;
	/** Distinct description ids, with an owned target first when there is one. */
	readonly descriptionIds: string[];
	/** Distinct error container ids, with an owned target first when there is one. */
	readonly errorIds: string[];
	readonly associations: AssociationRegistry;
}

/** A field whose transport lets Formsnap name the control, so presentation owns `name`. */
export interface NamedPresentationField extends PresentationField {
	readonly name: string;
}

/**
 * Narrows to a field presentation can name. Only a Formsnap-named backend may read the name; a
 * remote field goes through `RemoteControl`, whose attributes omit it.
 */
export function getNamedField(field: PresentationField): NamedPresentationField {
	if (!isNamedField(field)) {
		throw new Error(
			"Formsnap cannot name this control: the field's transport owns the name attribute. A Kit " +
				"remote field is presented with RemoteControl from the remote entry point, whose attributes " +
				"omit both name and aria-invalid so that Kit's as(...) props supply them."
		);
	}
	return field;
}

function isNamedField(field: PresentationField): field is NamedPresentationField {
	return field.name !== undefined;
}

type OwnedAssociationProps = {
	descriptionId?: { current: string | undefined };
	fieldErrorsId?: { current: string | undefined };
};

/**
 * Description and error registrations belong to their contributors, not to their id strings.
 * Several owners can describe the same element; releasing one owner must leave the others intact.
 */
export class AssociationIds implements AssociationRegistry {
	#owned: OwnedAssociationProps;
	#descriptions = $state<{ owner: symbol; id: string }[]>([]);
	#errors = $state<{ owner: symbol; id: string }[]>([]);
	#descriptionIds = $derived.by(() => {
		const ownedId = this.#owned.descriptionId?.current;
		const mountedIds = this.#descriptions.map(({ id }) => id);
		const ids = ownedId === undefined ? mountedIds : [ownedId, ...mountedIds];
		return ids.filter((id, index) => ids.indexOf(id) === index);
	});
	#errorIds = $derived.by(() => {
		const ownedId = this.#owned.fieldErrorsId?.current;
		const mountedIds = this.#errors.map(({ id }) => id);
		const ids = ownedId === undefined ? mountedIds : [ownedId, ...mountedIds];
		return ids.filter((id, index) => ids.indexOf(id) === index);
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

/**
 * Named in the failure a missing provider produces. A backend reads the same context with its own
 * type, so the wording is shared rather than repeated.
 */
export const FIELD_CONTEXT_PROVIDERS = "Field, Fieldset or ElementField";

/** Installs the field scope for a component subtree. Backends call `setContext` with this key. */
export const FORM_FIELD_CTX = Symbol.for("formsnap.form-field");
export const FORM_CONTROL_CTX = Symbol.for("formsnap.form-control");

export function getPresentationField(): PresentationField {
	return getRequiredContext<PresentationField>(FORM_FIELD_CTX, FIELD_CONTEXT_PROVIDERS);
}

type FieldErrorsStateProps = WithRefProps &
	ReadableBoxedValues<{ live: FieldErrorsLive | undefined }>;

class FieldErrorsState {
	#attachment: AssociationAttachment;
	#id: FieldErrorsStateProps["id"];
	#live: FieldErrorsStateProps["live"];
	field: PresentationField;

	constructor(props: FieldErrorsStateProps, field: PresentationField) {
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
	field: PresentationField;

	constructor(props: DescriptionStateProps, field: PresentationField) {
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

/** Label attributes shared by a control's headless naming and its rendered `Label` elements. */
function getLabelAttrs(control: ControlState, id: string): LabelAttrs {
	return {
		id,
		"data-fs-label": "",
		"data-fs-error": getDataFsError(control.field.errors),
		for: control.id,
	};
}

class ControlState {
	#id: ControlStateProps["id"];
	/** Owner-scoped headless getters, resolved synchronously with the control's props. */
	#overrides = $state<{ owner: symbol; id: Getter<string | null | undefined> }[]>([]);
	#labels = $state<{ owner: symbol; id: Getter<string | undefined> }[]>([]);
	field: PresentationField;
	/** Default id for consumers rendering their own headless label without a `Label` component. */
	#labelId: ControlStateProps["labelId"];

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

	constructor(props: ControlStateProps, field: PresentationField) {
		this.#id = props.id;
		this.#labelId = props.labelId;
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

	/** Component registration order stays fixed; inactive labels do not contribute naming. */
	addLabel(id: Getter<string | undefined>) {
		const owner = Symbol();
		untrack(() => {
			this.#labels = [...this.#labels, { owner, id }];
		});
		return () => {
			untrack(() => {
				this.#labels = this.#labels.filter((entry) => entry.owner !== owner);
			});
		};
	}

	get labelId(): string {
		for (let index = this.#labels.length - 1; index >= 0; index--) {
			const id = this.#labels[index].id();
			if (id !== undefined) return id;
		}
		return this.#labelId.current;
	}

	get props(): ControlAttrs {
		const field = getNamedField(this.field);
		return {
			id: this.id,
			name: field.name,
			"data-fs-error": getDataFsError(this.field.errors),
			"aria-describedby": getAriaDescribedBy({
				errorIds: this.field.errorIds,
				descriptionIds: this.field.descriptionIds,
				errors: this.field.errors,
			}),
			"aria-invalid": getAriaInvalid(this.field.errors),
			"aria-required": getAriaRequired(this.field.constraints),
			"data-fs-control": "",
		};
	}

	/**
	 * The attributes Formsnap contributes when the transport owns the control's name and invalid
	 * state, as Kit's `as(...)` does for a remote form. The two sources share no key, so the
	 * transport's props and these can be spread in either order.
	 */
	transportProps = $derived.by(() => ({
		id: this.id,
		"data-fs-error": getDataFsError(this.field.errors),
		"aria-describedby": getAriaDescribedBy({
			errorIds: this.field.errorIds,
			descriptionIds: this.field.descriptionIds,
			errors: this.field.errors,
		}),
		"aria-required": getAriaRequired(this.field.constraints),
		"data-fs-control": "",
	}));

	/**
	 * Resolved on read rather than memoized in a derived: Svelte's server runtime memoizes deriveds
	 * created during render and never invalidates them, so a `Label` registering after an earlier
	 * read (its sibling reads these props while rendering) would leave the naming id stale in
	 * server-rendered HTML. Reading resolves the currently active owner in both runtimes.
	 */
	get labelProps(): LabelAttrs {
		return getLabelAttrs(this, this.labelId);
	}
}

type LabelStateProps = WithRefProps;

class LabelState {
	#id: LabelStateProps["id"];
	#attachment: AssociationAttachment;
	control: ControlState;

	constructor(props: LabelStateProps, control: ControlState) {
		this.#id = props.id;
		this.control = control;
		let node = $state<HTMLElement | null>(null);
		// Register once for the component lifetime, including synchronous server-rendered naming.
		// Attachment refreshes must not promote an older label ahead of a surviving newer one.
		let active = $derived(true);
		onDestroy(control.addLabel(() => (active ? props.id.current : undefined)));
		this.#attachment = {
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
			active = node !== null && node.id === props.id.current;
		});
	}

	// Render from this label's identity, not the control's currently selected naming owner.
	// Reading control.labelProps here would couple attachment refreshes to naming activity.
	props = $derived.by(
		() =>
			({
				...getLabelAttrs(this.control, this.#id.current),
				...this.#attachment,
			}) satisfies LabelAttrs
	);
}

type LegendStateProps = WithRefProps;

class LegendState {
	#ref: LegendStateProps["ref"];
	#id: LegendStateProps["id"];
	field: PresentationField;

	constructor(props: LegendStateProps, field: PresentationField) {
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

export function useFieldErrors(props: FieldErrorsStateProps) {
	return new FieldErrorsState(props, getPresentationField());
}

export function useDescription(props: DescriptionStateProps) {
	return new DescriptionState(props, getPresentationField());
}

export function useControl(props: ControlStateProps) {
	return setContext(FORM_CONTROL_CTX, new ControlState(props, getPresentationField()));
}

/** The control scope a `Label` or a headless consumer attaches to. */
function getControl() {
	return getRequiredContext<ControlState>(FORM_CONTROL_CTX, "Control");
}

export function useLabel(props: LabelStateProps) {
	return new LabelState(props, getControl());
}

export function useLegend(props: LegendStateProps) {
	return new LegendState(props, getPresentationField());
}

export type UseFormControlProps = {
	/** Optionally provide a function that returns the ID of the control element. */
	id?: Getter<string | undefined | null>;
};

export function useFormControl(props: UseFormControlProps) {
	const controlState = getControl();
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
