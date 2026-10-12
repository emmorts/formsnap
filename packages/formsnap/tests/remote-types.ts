/**
 * Compile-only contracts checked by svelte-check. Derive Kit field types from real form values;
 * SvelteKit does not export those types from @sveltejs/kit.
 */
import type { form as kitForm } from "$app/server";
import type { Snippet } from "svelte";
import { expectTypeOf } from "vitest";
import { z } from "zod";
import type { TransportControlAttrs } from "$lib/attrs.types.js";
import type {
	RemoteControlProps,
	RemoteFieldProps,
	UseRemoteFieldViewResult,
} from "$lib/remote/index.js";
import { useRemoteFormField, type RemoteFieldState } from "$lib/remote/index.js";
import { saveRemote } from "../src/routes/remote/save.remote.js";
import { saveRemoteOrder } from "../src/routes/recipes/remote/save.remote.js";
import { saveTransport } from "../src/routes/recipes/remote-transport/save.remote.js";

const fields = saveRemote.fields;

// Structured issues

expectTypeOf(fields.handle.issues()).toEqualTypeOf<
	{ message: string; path: Array<string | number> }[] | undefined
>();
expectTypeOf(fields.links.allIssues()).toEqualTypeOf<
	{ message: string; path: Array<string | number> }[] | undefined
>();
expectTypeOf(fields.links[0].url.issues()).toEqualTypeOf<
	{ message: string; path: Array<string | number> }[] | undefined
>();

// Form-owned transport and submission

expectTypeOf(saveRemote.method).toEqualTypeOf<"POST">();
expectTypeOf(saveRemote.action).toEqualTypeOf<string>();
expectTypeOf(saveRemote.pending).toEqualTypeOf<number>();
expectTypeOf(saveRemote.submitted).toEqualTypeOf<boolean>();

// Kit 3 validation options.
saveRemote.validate({ all: true });
saveRemote.validate({ preflightOnly: true });
// @ts-expect-error The released runtime does not accept `includeUntouched`.
saveRemote.validate({ includeUntouched: true });

// Field value inference

type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

// A leaf keeps its own value type, with `undefined` for the partial structure Kit returns while the
// form is incomplete. Nothing here is widened to `unknown` or to a shared field interface.
expectTypeOf(fields.handle.value()).toEqualTypeOf<string | undefined>();
expectTypeOf(fields.seats.value()).toEqualTypeOf<number | undefined>();
expectTypeOf(fields.notifications.value()).toEqualTypeOf<boolean | undefined>();
expectTypeOf(fields._password.value()).toEqualTypeOf<string | undefined>();
expectTypeOf(saveRemoteOrder.fields.delivery.method.value()).toEqualTypeOf<
	"pickup" | "courier" | undefined
>();
expectTypeOf(saveRemoteOrder.fields.delivery.postcode.value()).toEqualTypeOf<string | undefined>();

// Schema input is the control contract even when the handler receives transformed output.
// A declared factory uses only Kit's public form signature; this module is compile-only.
declare const contractForm: typeof kitForm;
const inputSchema = z.object({
	optionalTitle: z.string().optional(),
	details: z
		.object({
			count: z.string().transform((value) => Number(value)),
			optionalSeats: z.number().optional(),
		})
		.optional(),
});
const inputContract = contractForm(inputSchema, (data) => {
	expectTypeOf(data.optionalTitle).toEqualTypeOf<string | undefined>();
	expectTypeOf(data.details?.count).toEqualTypeOf<number | undefined>();
	return data;
});
expectTypeOf<z.input<typeof inputSchema>["optionalTitle"]>().toEqualTypeOf<string | undefined>();
expectTypeOf(inputContract.result).toEqualTypeOf<z.output<typeof inputSchema> | undefined>();
expectTypeOf(inputContract.fields.optionalTitle.value()).toEqualTypeOf<string | undefined>();
expectTypeOf(inputContract.fields.details.count.value()).toEqualTypeOf<string | undefined>();
expectTypeOf(inputContract.fields.details.optionalSeats.value()).toEqualTypeOf<
	number | undefined
>();
inputContract.fields.optionalTitle.as("text");
inputContract.fields.details.count.as("text");
inputContract.fields.details.count.set("3");
inputContract.fields.details.optionalSeats.as("number");
// @ts-expect-error The transformed output is numeric, but the field still accepts string input.
inputContract.fields.details.count.as("number");
// @ts-expect-error A handler output value is not the transformed field's input value.
inputContract.fields.details.count.set(3);
expectTypeOf<
	UseRemoteFieldViewResult<typeof inputContract.fields.details.count>["field"]
>().toEqualTypeOf<typeof inputContract.fields.details.count>();

// Valid and invalid input kinds

fields.handle.as("text");
fields.handle.as("text", "Ada");
fields.handle.as("password");
fields.handle.as("email");
fields.handle.as("select");
fields.handle.as("radio", "one");
fields.handle.as("hidden", "one");
fields.handle.as("submit", "one");
fields.seats.as("number");
fields.seats.as("range");
fields.seats.as("hidden", 1);
fields.seats.as("submit", 1);
fields.notifications.as("checkbox");
fields.notifications.as("checkbox", false);
fields.notifications.as("hidden", true);
saveTransport.fields.subscribe.as("checkbox", true);
saveRemoteOrder.fields.delivery.method.as("select", "pickup");
saveTransport.fields.decision.as("submit", "save");
saveTransport.fields.decision.as("submit", "publish");
saveTransport.fields.attachment.as("file");
// An array leaf is one control per option, so its checkbox takes the option it stands for.
saveTransport.fields.channels.as("checkbox", "email");
saveTransport.fields.channels.as("checkbox", "email", true);
saveTransport.fields.channels.as("select multiple");

// @ts-expect-error A string leaf is not a number input.
fields.handle.as("number");
// @ts-expect-error A string leaf is not a checkbox.
fields.handle.as("checkbox");
// @ts-expect-error A radio input needs the value it stands for.
fields.handle.as("radio");
// @ts-expect-error A number leaf is not a checkbox.
fields.seats.as("checkbox");
// @ts-expect-error A number leaf is not a file control.
fields.seats.as("file");
// @ts-expect-error A boolean leaf is not a text input.
fields.notifications.as("text");
// @ts-expect-error A boolean leaf is not a file control.
fields.notifications.as("file");
// @ts-expect-error A file leaf is not a text input.
saveTransport.fields.attachment.as("text");
// @ts-expect-error A file leaf is not a number input.
saveTransport.fields.attachment.as("number");
// @ts-expect-error An enum leaf accepts only the options its schema declares.
saveTransport.fields.decision.as("select", "delete");
// @ts-expect-error A choice group's control needs the option it stands for.
saveTransport.fields.channels.as("checkbox");
// @ts-expect-error An array leaf is not a single-line text input.
saveTransport.fields.channels.as("text");

// Containers and indexed leaves

expectTypeOf<HasKey<typeof fields.links, "allIssues">>().toEqualTypeOf<true>();
expectTypeOf<HasKey<typeof fields.links, "as">>().toEqualTypeOf<false>();
expectTypeOf<HasKey<typeof saveRemoteOrder.fields.delivery, "allIssues">>().toEqualTypeOf<true>();
expectTypeOf<HasKey<typeof saveRemoteOrder.fields.delivery, "as">>().toEqualTypeOf<false>();
// @ts-expect-error An object-array container has no as() method.
fields.links.as("text");
// @ts-expect-error A whole group cannot be rendered as one control, whatever the input type.
saveRemoteOrder.fields.delivery.as("text");
// A member is reached through the group, and reads as the schema says it does.
expectTypeOf(fields.links[0].url.value()).toEqualTypeOf<string | undefined>();
fields.links[0].url.as("text");
saveRemoteOrder.fields.delivery.postcode.as("text");
// @ts-expect-error A member still carries only the input kinds its own value allows.
saveRemoteOrder.fields.delivery.postcode.as("number");

// Typed headless field access

// The result carries the Kit field the caller selected, Kit's own interaction state, and the
// presentation the scope owns. It invents no SuperForm: nothing here is a copied form or a method
// the remote backend does not have.
expectTypeOf(useRemoteFormField<typeof fields.handle>).returns.toEqualTypeOf<
	UseRemoteFieldViewResult<typeof fields.handle>
>();
expectTypeOf<UseRemoteFieldViewResult<typeof fields.handle>["field"]>().toEqualTypeOf<
	typeof fields.handle
>();
expectTypeOf<
	HasKey<UseRemoteFieldViewResult<typeof fields.handle>, "touched">
>().toEqualTypeOf<true>();
expectTypeOf<
	HasKey<UseRemoteFieldViewResult<typeof fields.handle>, "dirty">
>().toEqualTypeOf<true>();
expectTypeOf<
	HasKey<UseRemoteFieldViewResult<typeof fields.handle>, "form">
>().toEqualTypeOf<false>();
expectTypeOf<
	HasKey<UseRemoteFieldViewResult<typeof fields.handle>, "validate">
>().toEqualTypeOf<false>();
expectTypeOf<
	HasKey<UseRemoteFieldViewResult<typeof fields.handle>, "enhance">
>().toEqualTypeOf<false>();
expectTypeOf<
	HasKey<UseRemoteFieldViewResult<typeof fields.handle>, "tainted">
>().toEqualTypeOf<false>();
expectTypeOf<RemoteFieldState<typeof fields.handle>["errors"]>().toEqualTypeOf<string[]>();
// The component takes the caller's own field type, and no form of its own.
expectTypeOf<RemoteFieldProps<typeof fields.handle>["field"]>().toEqualTypeOf<
	typeof fields.handle
>();
const remoteFieldWithForm: RemoteFieldProps<typeof fields.handle> = {
	field: fields.handle,
	// @ts-expect-error A remote field has no Superforms form to pass: Kit owns the form itself.
	form: null,
};
export { remoteFieldWithForm };

// Presentation must not claim transport-owned attributes

expectTypeOf<NonNullable<RemoteControlProps["children"]>>().toEqualTypeOf<
	Snippet<[{ props: TransportControlAttrs }]>
>();
expectTypeOf<HasKey<TransportControlAttrs, "name">>().toEqualTypeOf<false>();
expectTypeOf<HasKey<TransportControlAttrs, "aria-invalid">>().toEqualTypeOf<false>();
expectTypeOf<HasKey<TransportControlAttrs, "aria-describedby">>().toEqualTypeOf<true>();
expectTypeOf<TransportControlAttrs["aria-required"]>().toEqualTypeOf<"true" | undefined>();
