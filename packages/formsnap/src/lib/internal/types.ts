import type { ReadableBox, WritableBox } from "svelte-toolbelt";

/**
 * Backend-independent type helpers, shared by both entry points.
 *
 * Nothing here may import `sveltekit-superforms`: the remote entry's published declarations reach
 * this module, and a remote-only consumer does not install Superforms. The Superforms-typed path
 * lookup that used to live here is in `form-path.ts`.
 */

export type Box<T> = ReadableBox<T> | WritableBox<T>;

/**
 * Component IDs are optional strings, not nullable DOM IDs. Custom `children`
 * snippets are typed separately from native element attributes.
 */
export type Primitive<T> = Omit<T, "id" | "children"> & { id?: string };
