import { z } from "zod/v3";

function calendarDate(value: string) {
	const match = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(value);
	if (!match || match[0] !== value) return undefined;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (!Number.isSafeInteger(year) || year < 1 || month < 1 || month > 12) {
		return undefined;
	}

	const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const daysInMonth =
		month === 2
			? leapYear
				? 29
				: 28
			: month === 4 || month === 6 || month === 9 || month === 11
				? 30
				: 31;
	if (day < 1 || day > daysInMonth) return undefined;

	return { year, month, day };
}

export const errorsSchema = z
	.object({
		start: z.string().min(1, "Choose a start date."),
		end: z.string().min(1, "Choose an end date."),
		contactNeeded: z.boolean().default(false),
		phone: z.string().default(""),
	})
	.superRefine((booking, context) => {
		const start = calendarDate(booking.start);
		const end = calendarDate(booking.end);
		if (booking.start && !start) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["start"],
				message: "Choose a valid start date.",
			});
		}
		if (booking.end && !end) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["end"],
				message: "Choose a valid end date.",
			});
		}
		if (
			start &&
			end &&
			(end.year < start.year ||
				(end.year === start.year &&
					(end.month < start.month ||
						(end.month === start.month && end.day <= start.day))))
		) {
			// No field path: Superforms puts this cross-field issue in errors._errors.
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "The end date must be after the start date.",
			});
		}
		if (booking.contactNeeded && !booking.phone.trim()) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["phone"],
				message: "Enter a contact phone number.",
			});
		}
	});

export type ErrorsData = z.infer<typeof errorsSchema>;
