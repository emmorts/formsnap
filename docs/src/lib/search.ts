export type SearchEntry = {
	href: string;
	title: string;
	section: string;
	text: string;
};

/** A half-open range of offsets into the original, un-normalized string. */
export type HighlightRange = readonly [start: number, end: number];

export type SearchResult = {
	entry: SearchEntry;
	score: number;
	/** How many query terms this section matched. */
	matched: number;
	/** True when every query term matched. */
	complete: boolean;
	snippet: string;
	snippetRanges: HighlightRange[];
	titleRanges: HighlightRange[];
	sectionRanges: HighlightRange[];
};

export type SearchOutcome = {
	results: SearchResult[];
	terms: string[];
	/** True when every returned section matched every term; false means related matches only. */
	complete: boolean;
};

type Word = { start: number; end: number; text: string };

/**
 * One searchable field, normalized once per entry. `normal` splits identifiers so "useFormField" is
 * reachable as "use form field"; `compact` joins them again so a query typed without boundaries
 * ("useformfield") still matches. Both carry an index map back into the original string, which is
 * what lets a match highlight the real text.
 */
type Field = {
	normal: string;
	map: number[];
	words: Word[];
	compact: string;
	compactMap: number[];
	/** The same words in joined coordinates, for checking that a match lines up with whole words. */
	compactWords: Word[];
};

type Prepared = { title: Field; section: Field; text: Field };

type Match = { score: number; start: number; ranges: HighlightRange[] };

/** Names and headings answer a question better than the prose around them. */
const FIELD_WEIGHTS = {
	section: { weight: 12, heading: true },
	title: { weight: 6, heading: true },
	text: { weight: 3, heading: false },
} as const;

/**
 * A tolerated typo is weaker evidence than a literal match, so fuzzy scores stay below the literal
 * ones: a typo in a heading beats a closer typo in prose, and among headings the closer one wins.
 */
const FUZZY_HEADING_BASE = 1;
const FUZZY_TEXT_BASE = 0.5;
const FUZZY_SIMILARITY_SHARE = 0.4;

const SNIPPET_LENGTH = 200;
const COMBINING = /\p{M}+/gu;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const WORD_RUN = /[\p{L}\p{N}]+/gu;

function prepareField(value: string): Field {
	const characters: string[] = [];
	const map: number[] = [];
	// Boundary detection needs the original case, so the previous character is kept unlowercased.
	let previousCharacter = "";
	for (let index = 0; index < value.length; index++) {
		const decomposed = value[index].normalize("NFKD").replace(COMBINING, "");
		for (const character of decomposed) {
			if (!WORD_CHARACTER.test(character)) {
				if (characters.at(-1) !== " ") {
					characters.push(" ");
					map.push(index);
				}
				previousCharacter = "";
				continue;
			}
			// Split identifiers so "useFormField" is reachable as "use form field" and "zod4" as
			// "zod 4"; the split character stays in the map, so highlights cover the real text.
			const boundary =
				previousCharacter !== "" &&
				((previousCharacter.toLowerCase() === previousCharacter &&
					character !== character.toLowerCase()) ||
					/\d/.test(previousCharacter) !== /\d/.test(character));
			if (boundary) {
				characters.push(" ");
				map.push(index);
			}
			characters.push(character.toLocaleLowerCase("en"));
			map.push(index);
			previousCharacter = character;
		}
	}

	const normal = characters.join("");
	const words: Word[] = [];
	for (const match of normal.matchAll(WORD_RUN)) {
		const start = match.index ?? 0;
		words.push({ start, end: start + match[0].length, text: match[0] });
	}

	const compactCharacters: string[] = [];
	const compactMap: number[] = [];
	const compactWords: Word[] = [];
	for (const word of words) {
		const start = compactCharacters.length;
		for (let offset = word.start; offset < word.end; offset++) {
			compactCharacters.push(normal[offset]);
			compactMap.push(map[offset]);
		}
		compactWords.push({ start, end: compactCharacters.length, text: word.text });
	}

	const compact = compactCharacters.join("");

	return {
		normal,
		map,
		words,
		compact,
		compactMap,
		compactWords,
	};
}

const preparedCache = new WeakMap<SearchEntry, Prepared>();

/** Entries are stable objects, so each field is normalized once and reused across keystrokes. */
function prepared(entry: SearchEntry): Prepared {
	let value = preparedCache.get(entry);
	if (!value) {
		value = {
			title: prepareField(entry.title),
			section: prepareField(entry.section),
			text: prepareField(entry.text),
		};
		preparedCache.set(entry, value);
	}
	return value;
}

/** Maps a span of normalized text back to the original string, for highlighting. */
function rawRange(map: number[], start: number, end: number): HighlightRange {
	const from = map[start] ?? map.at(-1) ?? 0;
	return [from, (map[end - 1] ?? from) + 1];
}

/**
 * Optimal string alignment distance (Levenshtein plus adjacent transpositions), so a swapped pair of
 * letters costs one edit: "recpie" reaches "recipes". Buffers are reused; the length difference
 * filter in the caller keeps every comparison small.
 */
let editBuffers: [Uint16Array, Uint16Array, Uint16Array] | undefined;

function editDistance(a: string, b: string, limit: number): number {
	if (Math.abs(a.length - b.length) > limit) return limit + 1;
	const columns = b.length + 1;
	if (!editBuffers || editBuffers[0].length < columns) {
		editBuffers = [
			new Uint16Array(columns),
			new Uint16Array(columns),
			new Uint16Array(columns),
		];
	}
	let [twoRowsBack, previous, current] = editBuffers;
	for (let column = 0; column < columns; column++) previous[column] = column;

	for (let row = 1; row <= a.length; row++) {
		current[0] = row;
		for (let column = 1; column < columns; column++) {
			const substitution = a[row - 1] === b[column - 1] ? 0 : 1;
			let distance = Math.min(
				previous[column] + 1,
				current[column - 1] + 1,
				previous[column - 1] + substitution
			);
			if (
				row > 1 &&
				column > 1 &&
				a[row - 1] === b[column - 2] &&
				a[row - 2] === b[column - 1]
			) {
				distance = Math.min(distance, twoRowsBack[column - 2] + 1);
			}
			current[column] = distance;
		}
		const rotation = twoRowsBack;
		twoRowsBack = previous;
		previous = current;
		current = rotation;
	}

	return previous[b.length];
}

/**
 * Scores one term against one field, strongest evidence first: the whole word, then a word prefix,
 * then a substring, then the joined identifier form, then a small number of typos. Returns null when
 * the field does not carry the term at all.
 */
function matchField(
	field: Field,
	term: string,
	{ weight, heading }: { weight: number; heading: boolean }
): Match | null {
	for (const word of field.words) {
		if (word.text === term) {
			const range = rawRange(field.map, word.start, word.end);
			return { score: weight, start: range[0], ranges: [range] };
		}
	}

	if (term.length >= 2) {
		let shortest: Word | undefined;
		for (const word of field.words) {
			if (!word.text.startsWith(term)) continue;
			if (!shortest || word.text.length < shortest.text.length) shortest = word;
		}
		if (shortest) {
			const ratio = term.length / shortest.text.length;
			const range = rawRange(field.map, shortest.start, shortest.end);
			return { score: weight * (0.55 + 0.35 * ratio), start: range[0], ranges: [range] };
		}
	}

	const inline = field.normal.indexOf(term);
	if (inline !== -1) {
		const range = rawRange(field.map, inline, inline + term.length);
		return { score: weight * 0.45, start: range[0], ranges: [range] };
	}

	// The joined form answers identifier-style queries ("useformfield", "formfield"), but only when
	// the match lines up with whole words: otherwise "fieldst" would match "field" + "st(ate)".
	const joined = field.compact.indexOf(term);
	if (joined !== -1) {
		const end = joined + term.length;
		const startsWord = field.compactWords.some((word) => word.start === joined);
		const endsWord = field.compactWords.some((word) => word.end === end);
		if (startsWord && (endsWord || joined === 0)) {
			const range = rawRange(field.compactMap, joined, end);
			return { score: weight * 0.45, start: range[0], ranges: [range] };
		}
	}

	// Typos: one edit for short words, more room as the word grows, and never for one- or two-letter
	// terms where any word would look similar.
	const limit = term.length < 3 ? 0 : term.length < 5 ? 1 : term.length < 9 ? 2 : 3;
	if (!limit) return null;

	let closest: { word: Word; distance: number } | undefined;
	for (const word of field.words) {
		if (Math.abs(word.text.length - term.length) > limit) continue;
		const distance = editDistance(term, word.text, limit);
		if (distance > limit) continue;
		if (!closest || distance < closest.distance) closest = { word, distance };
	}
	if (!closest) return null;

	const range = rawRange(field.map, closest.word.start, closest.word.end);
	return {
		score:
			(heading ? FUZZY_HEADING_BASE : FUZZY_TEXT_BASE) +
			FUZZY_SIMILARITY_SHARE * (1 - closest.distance / (term.length + 1)),
		start: range[0],
		ranges: [range],
	};
}

function mergeRanges(ranges: readonly HighlightRange[]): HighlightRange[] {
	const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const merged: HighlightRange[] = [];
	for (const range of sorted) {
		const last = merged.at(-1);
		if (last && range[0] <= last[1]) {
			merged[merged.length - 1] = [last[0], Math.max(last[1], range[1])];
			continue;
		}
		merged.push(range);
	}
	return merged;
}

/** Cuts a readable window out of the body text around the first match, on word boundaries. */
function windowSnippet(
	text: string,
	ranges: readonly HighlightRange[],
	focus: number
): { text: string; ranges: HighlightRange[] } {
	if (text.length <= SNIPPET_LENGTH) return { text, ranges: mergeRanges(ranges) };

	const anchor = Number.isFinite(focus) ? Math.max(0, focus - 60) : 0;
	let from = Math.max(0, Math.min(anchor, text.length - SNIPPET_LENGTH));
	let to = Math.min(text.length, from + SNIPPET_LENGTH);
	const nextSpace = text.indexOf(" ", from);
	if (from > 0 && nextSpace !== -1 && nextSpace < to) from = nextSpace + 1;
	const previousSpace = text.lastIndexOf(" ", to);
	if (to < text.length && previousSpace > from) to = previousSpace;

	const prefix = from > 0 ? "…" : "";
	const snippet = `${prefix}${text.slice(from, to)}${to < text.length ? "…" : ""}`;
	const shift = prefix.length - from;
	const clipped: HighlightRange[] = [];
	for (const [start, end] of mergeRanges(ranges)) {
		const clippedStart = Math.max(0, Math.min(snippet.length, start + shift));
		const clippedEnd = Math.max(0, Math.min(snippet.length, end + shift));
		if (clippedEnd > clippedStart) clipped.push([clippedStart, clippedEnd]);
	}

	return { text: snippet, ranges: clipped };
}

function scoreEntry(
	entry: SearchEntry,
	fields: Prepared,
	terms: readonly string[]
): SearchResult | null {
	const targets = [
		{ field: fields.section, ...FIELD_WEIGHTS.section, ranges: [] as HighlightRange[] },
		{ field: fields.title, ...FIELD_WEIGHTS.title, ranges: [] as HighlightRange[] },
		{ field: fields.text, ...FIELD_WEIGHTS.text, ranges: [] as HighlightRange[] },
	];

	let score = 0;
	let matched = 0;
	let textStart = Number.POSITIVE_INFINITY;

	for (const term of terms) {
		let best = 0;
		for (const target of targets) {
			const match = matchField(target.field, term, target);
			if (!match) continue;
			target.ranges.push(...match.ranges);
			if (match.score > best) best = match.score;
			if (target.field === fields.text && match.start < textStart) textStart = match.start;
		}
		if (!best) continue;
		matched += 1;
		score += best;
	}

	if (!matched) return null;
	// Terms appearing together are a stronger signal than the same terms scattered apart.
	if (terms.length > 1 && fields.text.normal.includes(terms.join(" "))) score += 2;

	const snippet = windowSnippet(entry.text, targets[2].ranges, textStart);
	return {
		entry,
		score,
		matched,
		complete: matched === terms.length,
		snippet: snippet.text,
		snippetRanges: snippet.ranges,
		titleRanges: mergeRanges(targets[1].ranges),
		sectionRanges: mergeRanges(targets[0].ranges),
	};
}

/** Splits a query the same way the index splits text, so identifiers match from either side. */
export function tokenizeQuery(query: string): string[] {
	return [...new Set(prepareField(query).words.map((word) => word.text))];
}

/** Splits text into alternating plain and matched segments for rendering. */
export function highlightSegments(
	text: string,
	ranges: readonly HighlightRange[]
): { text: string; match: boolean }[] {
	const segments: { text: string; match: boolean }[] = [];
	let cursor = 0;
	for (const [start, end] of mergeRanges(ranges)) {
		if (start > cursor) segments.push({ text: text.slice(cursor, start), match: false });
		segments.push({ text: text.slice(start, end), match: true });
		cursor = end;
	}
	if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
	return segments;
}

/**
 * Ranks sections for a query. Every term that matches contributes, typos are tolerated, and a
 * section matching all terms always outranks one matching some: only when nothing matches every
 * term do the related matches come back, flagged by `complete: false`.
 */
export function searchDocumentation(entries: readonly SearchEntry[], query: string): SearchOutcome {
	const terms = tokenizeQuery(query);
	if (!terms.length) return { results: [], terms, complete: true };

	const scored: SearchResult[] = [];
	for (const entry of entries) {
		const result = scoreEntry(entry, prepared(entry), terms);
		if (result) scored.push(result);
	}

	const exact = scored.filter((result) => result.complete);
	const results = exact.length ? exact : scored;
	results.sort(
		(a, b) =>
			b.matched - a.matched ||
			b.score - a.score ||
			Number(Boolean(b.entry.section)) - Number(Boolean(a.entry.section)) ||
			a.entry.href.localeCompare(b.entry.href, "en")
	);

	return { results, terms, complete: exact.length > 0 };
}
