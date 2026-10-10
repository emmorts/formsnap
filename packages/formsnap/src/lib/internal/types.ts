import type { ReadableBox, WritableBox } from "svelte-toolbelt";
import type { FormPathType } from "sveltekit-superforms";

/**
 * Superforms resolves leaf types, but removes nullability while traversing ancestors.
 * A missing optional ancestor makes Formsnap's runtime lookup return `undefined`.
 */
type MissingAncestor<T, P extends string> = P extends keyof T
	? never
	: undefined extends T
		? undefined
		: null extends T
			? undefined
			: P extends `.${infer Rest}`
				? MissingAncestor<T, Rest>
				: P extends `${number}]${infer Rest}`
					? T extends (infer Element)[]
						? MissingAncestor<Element, Rest>
						: never
					: P extends `${infer Key}[${infer Rest}`
						? Key extends keyof T
							? MissingAncestor<T[Key], Rest>
							: MissingAncestor<T, Rest>
						: P extends `${infer Key}.${infer Rest}`
							? Key extends keyof T
								? MissingAncestor<T[Key], Rest>
								: never
							: never;

export type FormPathValue<T, P extends string> = FormPathType<T, P> | MissingAncestor<T, P>;

export type Box<T> = ReadableBox<T> | WritableBox<T>;

/**
 * Component IDs are optional strings, not nullable DOM IDs. Custom `children`
 * snippets are typed separately from native element attributes.
 */
export type Primitive<T> = Omit<T, "id" | "children"> & { id?: string };
