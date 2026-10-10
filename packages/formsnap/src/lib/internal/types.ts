import type { ReadableBox, WritableBox } from "svelte-toolbelt";

export type Box<T> = ReadableBox<T> | WritableBox<T>;

/**
 * We override the `id` prop type to not allow it to be `null`. We rely on the
 * `id` heavily in the internals of Bits UI for node references. We also override
 * children to allow for custom children snippet props. We extend `style` to allow
 * for either a `StyleProperties` object or a string of CSS properties.
 */
export type Primitive<T> = Omit<T, "id" | "children"> & { id?: string };
