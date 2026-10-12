import { decodeHTMLStrict } from "entities";
import { Lexer, type Token, type Tokens } from "marked";

export type InlineOptions = {
	/** Deployment base path, applied to root-relative link targets. */
	base?: string;
};

type Mode = "html" | "text";

/** Escaping is a single contract shared by every text leaf: description Markdown is never markup. */
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** Leaves keep their text in plain mode and gain HTML escaping in HTML mode. */
function leaf(value: string, mode: Mode): string {
	return mode === "html" ? escapeHtml(value) : value;
}

/** Inline containers behave the same in both modes; only plain mode drops the element itself. */
function element(tag: string, inner: string, mode: Mode): string {
	return mode === "html" ? `<${tag}>${inner}</${tag}>` : inner;
}

/** Inline tokens nest their children under `tokens`; containers without children render nothing. */
function nested(token: Token): Token[] {
	return "tokens" in token && Array.isArray(token.tokens) ? (token.tokens as Token[]) : [];
}

/** Match browser URL handling, including mixed case and ignored ASCII controls in schemes. */
function linkTarget(href: string, base: string): string | null {
	const decoded = decodeHTMLStrict(href);
	try {
		const { protocol } = new URL(decoded, "https://formsnap.invalid");
		if (
			protocol !== "http:" &&
			protocol !== "https:" &&
			protocol !== "mailto:" &&
			protocol !== "tel:"
		) {
			return null;
		}
	} catch {
		return null;
	}

	// Only root-relative app paths need the deployment base; other destinations stay untouched.
	return decoded.startsWith("/") && !decoded.startsWith("//") && base
		? `${base}${decoded}`
		: decoded;
}

function render(tokens: readonly Token[], base: string, mode: Mode): string {
	let output = "";

	for (const token of tokens) {
		switch (token.type) {
			case "text": {
				const children = nested(token);
				output += children.length
					? render(children, base, mode)
					: leaf(decodeHTMLStrict((token as Tokens.Text).text ?? ""), mode);
				break;
			}
			case "escape":
				output += leaf((token as Tokens.Escape).text, mode);
				break;
			case "strong":
				output += element("strong", render(nested(token), base, mode), mode);
				break;
			case "em":
				output += element("em", render(nested(token), base, mode), mode);
				break;
			case "del":
				output += element("del", render(nested(token), base, mode), mode);
				break;
			case "codespan":
				output += element("code", leaf((token as Tokens.Codespan).text, mode), mode);
				break;
			case "link": {
				const inner = render(nested(token), base, mode);
				const target =
					mode === "html" ? linkTarget((token as Tokens.Link).href, base) : null;
				output += target === null ? inner : `<a href="${escapeHtml(target)}">${inner}</a>`;
				break;
			}
			case "image":
				output += leaf(render(nested(token), base, "text"), mode);
				break;
			case "br":
				output += mode === "html" ? "<br>" : " ";
				break;
			// Raw HTML and unrecognized inline markup are dropped: descriptions are text, not markup.
			default:
				break;
		}
	}

	return output;
}

/** Renders a description's inline Markdown as HTML. Raw HTML in the source is never emitted. */
export function inlineHtml(markdown: string, options: InlineOptions = {}): string {
	return render(Lexer.lexInline(markdown.trim()), options.base ?? "", "html").trim();
}

/** Renders a description's inline Markdown as plain text, for meta tags and the search index. */
export function inlinePlain(markdown: string): string {
	return render(Lexer.lexInline(markdown.trim()), "", "text").replace(/\s+/g, " ").trim();
}
