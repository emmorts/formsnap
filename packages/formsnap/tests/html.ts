import { parseHTML } from "linkedom";

/** Attributes whose value is a list of element ids, per the ARIA specification. */
const ID_LIST_ATTRIBUTES = ["aria-describedby", "aria-labelledby", "aria-errormessage"] as const;

/**
 * Returns every id reference in the document that does not resolve to a rendered element — the
 * accessibility failure that leaves assistive technology without a name, description or error.
 *
 * `linkedom` is used because the server-rendered HTML is asserted in a Node environment.
 */
export function danglingReferences(document: Document): string[] {
	const dangling: string[] = [];
	const selector = ["[for]", ...ID_LIST_ATTRIBUTES.map((attribute) => `[${attribute}]`)].join(
		","
	);

	for (const element of document.querySelectorAll(selector)) {
		const references: Array<{ attribute: string; id: string }> = [];
		const forAttribute = element.getAttribute("for");
		if (forAttribute) {
			for (const id of forAttribute.split(/\s+/)) references.push({ attribute: "for", id });
		}
		for (const attribute of ID_LIST_ATTRIBUTES) {
			const value = element.getAttribute(attribute);
			if (!value) continue;
			for (const id of value.split(/\s+/)) references.push({ attribute, id });
		}

		for (const { attribute, id } of references) {
			if (document.getElementById(id)) continue;
			const name = element.getAttribute("name");
			const identity = [element.getAttribute("id"), name && `name=${name}`]
				.filter(Boolean)
				.join(" ");
			dangling.push(
				`<${element.tagName.toLowerCase()}${identity ? ` ${identity}` : ""}> references "${id}" via ${attribute}, which is not rendered`
			);
		}
	}

	return dangling;
}

/** Returns ids that appear more than once, which breaks id-based association. */
export function duplicateIds(document: Document): string[] {
	const counts = new Map<string, number>();
	for (const element of document.querySelectorAll("[id]")) {
		const id = element.getAttribute("id");
		if (!id) continue;
		counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	return [...counts]
		.filter(([, count]) => count > 1)
		.map(([id, count]) => `"${id}" appears ${count} times`);
}

/** Parses server-rendered HTML into a queryable document. */
export function parseDocument(html: string): Document {
	return parseHTML(html).document as unknown as Document;
}
