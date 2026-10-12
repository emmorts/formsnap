import type { Snippet } from "svelte";
import type { FieldErrorsLive, TransportControlAttrs } from "$lib/attrs.types.js";

/**
 * Kit's RemoteForm field types are not exported from `@sveltejs/kit`. Structural constraints let
 * the caller's concrete field type flow through the components and hooks.
 */

/** A validation issue as Kit reports it: a message and the structured path it belongs to. */
export type RemoteIssue = {
	message: string;
	path: Array<string | number>;
};

/** Every Kit remote field has these, leaf or group. */
export type RemoteFieldLike = {
	value(): unknown;
	touched(): boolean;
	dirty(): boolean;
	issues(): RemoteIssue[] | undefined;
};

/** A group, or the form root, also aggregates the issues of everything below it. */
export type RemoteFieldContainerLike = RemoteFieldLike & {
	allIssues(): RemoteIssue[] | undefined;
};

/** The selected subtree's value type, taken from the field's own `value()` signature. */
export type RemoteFieldValue<F extends RemoteFieldLike> = ReturnType<F["value"]>;

/** The snippet props a remote field scope exposes. */
export type RemoteFieldSnippetProps<F extends RemoteFieldLike> = {
	/** The selected subtree's value, which Kit returns as a partial structure while incomplete. */
	value: RemoteFieldValue<F>;
	/** A copy of the field's exact issues, preserving their structured paths. */
	issues: RemoteIssue[] | undefined;
	/** The same issues as messages, which is what an inline error list renders. */
	errors: string[];
	/** Whether this field or anything below it has been interacted with. Not Superforms taint. */
	touched: boolean;
	/** Whether this field or anything below it has been edited. Not Superforms taint. */
	dirty: boolean;
	/** Explicit constraints, since Kit's `as(...)` derives none from a schema. */
	constraints: Record<string, unknown>;
};

/**
 * Owned description and error content for a remote field scope. The shape mirrors the Superforms
 * components so the two entries compose the same way.
 */
export type RemoteOwnedContentProps = {
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
 * Props for the remote `Field` equivalent.
 *
 * `field` is the selected Kit field, e.g. `myForm.fields.handle`. It is read through a getter rather
 * than keyed on the object, because a Kit accessor may hand back a fresh proxy on each read.
 */
export type RemoteFieldProps<F extends RemoteFieldLike> = RemoteOwnedContentProps & {
	field: F;
	/**
	 * Explicit constraints for this field. Kit's `as(...)` produces none, so nothing here is inferred
	 * from a schema, and `aria-required` reflects only what is passed.
	 */
	constraints?: Record<string, unknown>;
	children?: Snippet<[RemoteFieldSnippetProps<F>]>;
};

/**
 * Props for the remote `Fieldset` equivalent, which renders a native `<fieldset>` for a group.
 */
export type RemoteFieldsetProps<F extends RemoteFieldLike> = RemoteOwnedContentProps & {
	field: F;
	/** An id for the `<fieldset>` itself, distinct from the ids of the controls inside it. */
	id?: string;
	/** A ref to the `<fieldset>` element. */
	ref?: HTMLElement | null;
	constraints?: Record<string, unknown>;
	/** Render the whole element yourself, including the spread props. */
	child?: Snippet<
		[
			RemoteFieldSnippetProps<F> & {
				props: Record<string, unknown>;
			},
		]
	>;
	children?: Snippet<[RemoteFieldSnippetProps<F>]>;
};

/**
 * Props for the remote `Control` equivalent.
 *
 * The snippet receives the attributes Formsnap contributes, which never include `name` or
 * `aria-invalid`: those belong to the Kit props returned by `field.as(...)`. The two sets share no
 * key, so they can be spread in either order, and a caller has nothing to remove.
 */
export type RemoteControlProps = {
	/** An id for the control, overriding the generated one. */
	id?: string;
	children?: Snippet<[{ props: TransportControlAttrs }]>;
};
