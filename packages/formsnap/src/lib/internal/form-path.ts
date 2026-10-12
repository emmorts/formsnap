import type { FormPathType } from "sveltekit-superforms";

/**
 * Superforms-typed path lookup, kept apart from `types.ts` so the remote entry's published
 * declarations never reach this module.
 *
 * Superforms resolves leaf types, but strips nullable ancestors and treats every
 * array index as present. Formsnap's lookup has no fallback for a missing item.
 * Literal keys win over traversal; known tuple positions retain their own type.
 */
type ArrayItem<T extends readonly unknown[], Index extends string> = Index extends keyof T
	? T[Index]
	: number extends T["length"]
		? T[number] | undefined
		: `${number}` extends Index
			? T[number] | undefined
			: undefined;

type MissingAncestor<T, P extends string> = P extends keyof T
	? never
	: undefined extends T
		? undefined
		: null extends T
			? undefined
			: P extends `.${infer Rest}`
				? MissingAncestor<T, Rest>
				: P extends `${infer Index extends number}]${infer Rest}`
					? T extends readonly unknown[]
						? MissingAncestor<ArrayItem<T, `${Index}`>, Rest>
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

type PathValue<T, P extends string> = P extends keyof T
	? T[P]
	: P extends `.${infer Rest}`
		? PathValue<NonNullable<T>, Rest>
		: P extends `${infer Index extends number}]${infer Rest}`
			? NonNullable<T> extends readonly unknown[]
				? FormPathValue<ArrayItem<NonNullable<T>, `${Index}`>, Rest>
				: FormPathType<T, P>
			: P extends `${infer Key}[${infer Rest}`
				? Key extends keyof NonNullable<T>
					? FormPathValue<NonNullable<T>[Key], Rest>
					: FormPathValue<T, Rest>
				: P extends `${infer Key}.${infer Rest}`
					? Key extends keyof NonNullable<T>
						? FormPathValue<NonNullable<T>[Key], Rest>
						: FormPathType<T, P>
					: FormPathType<T, P>;

export type FormPathValue<T, P extends string> = PathValue<T, P> | MissingAncestor<T, P>;
