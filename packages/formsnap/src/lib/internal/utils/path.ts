export function getValueAtPath(path: string, obj: Record<string, unknown>) {
	// Preserve literal top-level field names containing path delimiters. The public path
	// types prioritize an exact property key over interpreting it as nested traversal.
	if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
	const keys = path.split(/[[\].]/).filter(Boolean);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let value = obj as any;

	for (const key of keys) {
		if (typeof value !== "object" || value === null) {
			return undefined; // Handle cases where the path doesn't exist in the object
		}
		value = value[key];
	}

	return value;
}
