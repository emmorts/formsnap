/**
 * Absolute `paths.base` without a trailing slash. Prefer `resolve()` from `$app/paths`
 * for in-app hrefs; use this only when a raw prefix is required (prerendered search-index
 * matching, description markdown link rewriting).
 */
export const deploymentBase: "" | `/${string}` = (() => {
	const url = import.meta.env.BASE_URL;
	if (url === "/") return "";
	return url.replace(/\/$/, "") as `/${string}`;
})();
