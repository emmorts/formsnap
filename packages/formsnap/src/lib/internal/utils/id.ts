/**
 * Builds an id for an element belonging to the component instance that owns it.
 *
 * `instanceId` is the value of `$props.id()` read at the top level of that component. Svelte
 * guarantees it is the same in the server-rendered HTML and during hydration, which a module-level
 * counter cannot promise: a counter's value depends on how many components the process created
 * before this one, so repeated renders of the same page produce different ids for the same element.
 */
export function useId(instanceId: string, suffix?: string) {
	return `formsnap-${instanceId}${suffix ? `-${suffix}` : ""}`;
}
