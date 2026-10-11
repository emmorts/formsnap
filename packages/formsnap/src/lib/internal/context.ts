import { getContext } from "svelte";

export function getRequiredContext<T>(key: symbol, providers: string): T {
	const context = getContext<T | undefined>(key);
	if (context === undefined) {
		throw new Error(`Formsnap context requires a parent ${providers}.`);
	}
	return context;
}
