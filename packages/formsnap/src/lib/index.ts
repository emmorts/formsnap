import type { SuperForm } from "sveltekit-superforms";

export type { SuperForm as _SuperForm };

export { useFormField, getFormField } from "./formsnap.svelte.js";
export type { UseFormFieldProps, UseFormFieldResult } from "./formsnap.svelte.js";

// Presentation state needs no Superforms form, so its hooks come from the backend-independent
// layer. The package root exports the same names as before; only their module moved.
export { useFormControl, getFormControl } from "./internal/presentation.svelte.js";
export type { UseFormControlProps } from "./internal/presentation.svelte.js";

export type * from "./attrs.types.js";
export * from "./components/index.js";
