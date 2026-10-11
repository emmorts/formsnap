import { json } from "@sveltejs/kit";
import { base } from "$app/paths";
import { navigation } from "$lib/config";
import { indexPage } from "$lib/search-index.server";

export const prerender = true;

const sources = import.meta.glob<string>("../docs/**/+page.svx", {
	query: "?raw",
	import: "default",
	eager: true,
});

export function GET() {
	const pages = navigation.flatMap((section) => section.items);
	const entries = Object.entries(sources).flatMap(([path, source]) => {
		const route = path.replace(/^\.\.\/docs/, "/docs").replace(/\/\+page\.svx$/, "");
		const href = `${base}${route}`;
		const title = pages.find((page) => page.href === href)?.title ?? "Formsnap";
		return indexPage(source, href, title);
	});
	return json(entries);
}
