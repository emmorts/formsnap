/**
 * Control styling shared by the site's live examples. One definition keeps every demo consistent
 * with the documentation's own look, including the invalid state that Formsnap toggles through
 * `aria-invalid`.
 */
export const inputClass =
	"w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-accent aria-[invalid=true]:border-rose-400";

export const labelClass = "mb-1.5 block text-sm font-medium text-fg";

export const hintClass = "mt-1.5 text-sm text-fg-muted";

export const errorClass = "mt-1.5 text-sm text-rose-400";

export const submitClass =
	"bg-accent text-accent-contrast rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50";

export const secondaryButtonClass =
	"border-line text-fg-muted hover:text-fg rounded-lg border px-3 py-2 text-sm transition-colors";

export const demoBoxClass = "border-line bg-surface-raised rounded-xl border p-5";
