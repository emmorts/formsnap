import type {
	DescriptionAttrs,
	ErrorAttrs,
	FieldErrorsAttrs,
	FieldErrorsLive,
} from "../../attrs.types.js";

/**
 * Parameters for the `getAriaDescribedBy` function.
 */
type AriaDescribedByParams = {
	/** The IDs contributed by error containers, in registration order. */
	errorIds?: string[];

	/** The IDs contributed by description elements, in registration order. */
	descriptionIds?: string[];

	/** The current validation errors for the field. */
	errors: string[];
};

/**
 * Retrieves the appropriate `aria-describedby` value for a form control
 * given the descriptions and error containers that are currently rendered.
 *
 * Error containers are only referenced while there are errors to announce, so a container that
 * unmounts, or one that is never rendered, is never pointed at.
 */
export function getAriaDescribedBy({
	errorIds = [],
	descriptionIds = [],
	errors,
}: AriaDescribedByParams) {
	const describedBy = errors.length ? [...descriptionIds, ...errorIds] : descriptionIds;
	return describedBy.length ? [...new Set(describedBy)].join(" ") : undefined;
}

/**
 * Retrieves the appropriate `aria-required` attribute value for a form
 * control given the constraints for the field.
 */
export function getAriaRequired(constraints: Record<string, unknown>) {
	if (!("required" in constraints)) return undefined;
	return constraints.required ? ("true" as const) : undefined;
}

/**
 * Retrieves the appropriate `aria-invalid` attribute value for a form
 * control given the current validation errors.
 */
export function getAriaInvalid(errors: string[] | undefined) {
	return errors && errors.length ? "true" : undefined;
}

/**
 * Retrieves the appropriate `data-fs-error` value for an element
 * given the current validation errors.
 */
export function getDataFsError(errors: string[] | undefined): string | undefined {
	return errors && errors.length ? "" : undefined;
}

export function getDescriptionProps(id: string, errors: string[]): DescriptionAttrs {
	return {
		id,
		"data-fs-description": "",
		"data-fs-error": getDataFsError(errors),
	};
}

export function getFieldErrorsProps(
	id: string,
	errors: string[],
	live: FieldErrorsLive = "assertive"
): FieldErrorsAttrs {
	return {
		id,
		"data-fs-field-errors": "",
		"data-fs-error": getDataFsError(errors),
		"aria-live": live,
	};
}

export function getErrorProps(errors: string[]): ErrorAttrs {
	return {
		"data-fs-field-error": "",
		"data-fs-error": getDataFsError(errors),
	};
}
