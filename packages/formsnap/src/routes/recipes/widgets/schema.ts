import { z } from "zod/v3";

export const deliveryOptions = [
	{ value: "standard", label: "Standard delivery" },
	{ value: "express", label: "Express delivery" },
] as const;

export const channelOptions = [
	{ value: "email", label: "Email" },
	{ value: "sms", label: "Text message" },
	{ value: "push", label: "Push notification" },
] as const;

export const collectionOptions = [
	{ value: "central", label: "Central depot" },
	{ value: "closed", label: "Closed depot", disabled: true },
	{ value: "east", label: "East depot" },
];

export const nativeSchema = z.object({
	delivery: z
		.string()
		.min(1, "Choose a delivery speed.")
		.default("")
		.refine(
			(value) => value === "" || deliveryOptions.some((option) => option.value === value),
			"Choose an available delivery speed."
		),
	channels: z
		.array(z.string())
		.min(1, "Choose at least one notification channel.")
		.max(2, "Choose no more than two notification channels.")
		.default([])
		.refine(
			(values) =>
				values.every((value) => channelOptions.some((option) => option.value === value)),
			"Choose available notification channels."
		),
});

export const compositeSchema = z.object({
	collection: z
		.string()
		.min(1, "Choose a collection point.")
		.default("")
		.refine(
			(value) =>
				value === "" ||
				collectionOptions.some((option) => !option.disabled && option.value === value),
			"Choose an open collection point."
		),
});

export type NativeData = z.infer<typeof nativeSchema>;
export type CompositeData = z.infer<typeof compositeSchema>;
