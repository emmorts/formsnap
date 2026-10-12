/**
 * `@emmorts/formsnap/remote` presents a native SvelteKit remote form with the same components and
 * attributes as a Superforms form.
 *
 * Nothing here imports Superforms, and nothing fabricates a `SuperForm`: a remote field scope has no
 * form prop, no captured store, and no invented `validate`/`enhance`/`reset`. Kit owns the control's
 * transport name and invalid state, so `RemoteControl` contributes neither and the Kit props from
 * `field.as(...)` supply both.
 */
export { default as RemoteField } from "./RemoteField.svelte";
export { default as RemoteFieldset } from "./RemoteFieldset.svelte";
export { default as RemoteControl } from "./RemoteControl.svelte";

export {
	getRemoteField,
	useRemoteField,
	useRemoteFormField,
	type RemoteFieldState,
	type RemoteFieldStateProps,
	type UseRemoteFieldViewProps,
	type UseRemoteFieldViewResult,
} from "./remote-field.svelte.js";

export type * from "./types.js";

/**
 * The presentation components are shared with the Superforms entry point rather than duplicated:
 * they read the field scope, and a remote field installs one exactly as a Superforms field does.
 */
export { default as Label } from "$lib/components/label.svelte";
export { default as Description } from "$lib/components/description.svelte";
export { default as FieldErrors } from "$lib/components/field-errors.svelte";
export { default as Legend } from "$lib/components/legend.svelte";
