export type Theme = "light" | "dark";

let theme = $state<Theme>("dark");

/** Reads the class the inline head script applied before first paint. */
export function initTheme() {
	theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function getTheme(): Theme {
	return theme;
}

export function toggleTheme() {
	theme = theme === "dark" ? "light" : "dark";
	document.documentElement.classList.toggle("dark", theme === "dark");
	try {
		localStorage.setItem("formsnap-theme", theme);
	} catch {
		// Storage can be blocked (private mode, partitioned contexts); the class change still applies.
	}
}
