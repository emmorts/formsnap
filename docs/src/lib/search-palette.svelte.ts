import { resolve } from "$app/paths";
import type { SearchEntry } from "./search";

/** Palette visibility is app-wide: the header triggers, the shortcut and the dialog all share it. */
export const searchPalette = $state({ open: false, query: "" });

export function openSearchPalette() {
	searchPalette.query = "";
	searchPalette.open = true;
}

export function closeSearchPalette() {
	searchPalette.open = false;
	searchPalette.query = "";
}

let index: Promise<SearchEntry[]> | undefined;

/** The index is prerendered and immutable, so every open shares the first request. */
export function loadSearchIndex(): Promise<SearchEntry[]> {
	index ??= fetch(resolve("/search-index.json"))
		.then((response) => {
			if (!response.ok) throw new Error(`Search index returned ${response.status}`);
			return response.json() as Promise<SearchEntry[]>;
		})
		.catch((error: unknown) => {
			// A failed request must not poison the cache: the next open tries again.
			index = undefined;
			throw error;
		});
	return index;
}
