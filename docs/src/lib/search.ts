export type SearchEntry = {
	href: string;
	title: string;
	section: string;
	text: string;
};

/** All query terms must match; names and headings rank above explanatory text. */
export function searchDocumentation(entries: SearchEntry[], query: string): SearchEntry[] {
	const terms = [...new Set(query.toLocaleLowerCase("en").trim().split(/\s+/).filter(Boolean))];
	if (!terms.length) return [];

	return entries
		.map((entry) => {
			const title = entry.title.toLocaleLowerCase("en");
			const section = entry.section.toLocaleLowerCase("en");
			const text = entry.text.toLocaleLowerCase("en");
			let score = 0;
			for (const term of terms) {
				if (section.includes(term)) score += 8;
				else if (title.includes(term)) score += 4;
				else if (text.includes(term)) score += 1;
				else return { entry, score: 0 };
			}
			return { entry, score };
		})
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score || a.entry.href.localeCompare(b.entry.href, "en"))
		.map(({ entry }) => entry);
}
