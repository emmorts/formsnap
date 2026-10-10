# Formsnap

Accessible, unstyled form components for [SvelteKit](https://svelte.dev/docs/kit), built on
[sveltekit-superforms](https://github.com/ciscoheat/sveltekit-superforms). Formsnap renders the
label, description and error markup and wires up the ARIA relationships; Superforms keeps owning
validation, submission and form state.

`@emmorts/formsnap` is the maintained fork of
[`formsnap`](https://github.com/svecosystem/formsnap) by
[@huntabyte](https://github.com/huntabyte). Component documentation lives at
[formsnap.dev](https://formsnap.dev) and describes the API this fork follows.

## Requirements

| Dependency             | Supported range                                |
| ---------------------- | ---------------------------------------------- |
| `svelte`               | `^5.30.2` — required by `svelte-toolbelt` 0.10 |
| `sveltekit-superforms` | `^2.19.0 \|\| ^3.0.0`                          |
| schema library         | any Superforms adapter; the example uses zod   |

Superforms 3.0.0 additionally requires Svelte `^5.56.4`. The Svelte 5.30.2 minimum applies
to Formsnap with Superforms 2; also satisfy the selected Superforms version's own peer range.

Under `sveltekit-superforms` 2.31 and later the zod adapter is typed against the zod v3 API at
`zod/v3`, and it has to be the same zod version Superforms resolves. Import your schema from
`zod/v3`, and keep a single zod version in your dependency tree (pnpm can install a second copy for
Superforms' own dependencies — check with `pnpm why zod`).

## Installation

```bash
npm i @emmorts/formsnap sveltekit-superforms zod
```

## Usage

Superforms owns the load and action. The following code matches the fixture app, apart from its
internal `$lib` import and test-only hydration marker. The fixture is type-checked and exercised
by the consumer tests.

### 1. Define a schema

```ts
// schema.ts
import { z } from "zod/v3";

export const settingsSchema = z.object({
	email: z.string().email(),
	bio: z.string().max(250),
});

export type SettingsData = z.infer<typeof settingsSchema>;
```

### 2. Load and validate submissions

```ts
// +page.server.ts
import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { settingsSchema } from "./schema.js";

export const load = async () => {
	return {
		form: await superValidate(zod(settingsSchema)),
	};
};

export const actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod(settingsSchema));
		if (!form.valid) return fail(400, { form });
		return { form };
	},
};
```

### 3. Render the fields

```svelte
<!-- settings-form.svelte -->
<script lang="ts">
	import { untrack } from "svelte";
	import { superForm } from "sveltekit-superforms";
	import type { SuperValidated } from "sveltekit-superforms";
	import { Control, Field, Label } from "@emmorts/formsnap";
	import type { SettingsData } from "./schema.js";

	let { validated }: { validated: SuperValidated<SettingsData> } = $props();

	// `superForm` reads the initial validation data once, so the read is deliberately untracked.
	const form = superForm(untrack(() => validated));
	const { form: formData } = form;
</script>

<form method="POST">
	<Field {form} name="email" fieldErrors>
		<Control id="email-input">
			{#snippet children({ props })}
				<Label>Email</Label>
				<input type="email" {...props} bind:value={$formData.email} />
			{/snippet}
		</Control>
		{#snippet description()}We'll email you about your account.{/snippet}
	</Field>

	<Field {form} name="bio" fieldErrors>
		<Control>
			{#snippet children({ props })}
				<Label>Bio</Label>
				<textarea {...props} bind:value={$formData.bio}></textarea>
			{/snippet}
		</Control>
		{#snippet description()}Tell us about yourself.{/snippet}
	</Field>
	<button type="submit">Save settings</button>
</form>
```

### 4. Pass the validated form to it

```svelte
<!-- +page.svelte -->
<script lang="ts">
	import type { SuperValidated } from "sveltekit-superforms";
	import SettingsForm from "./settings-form.svelte";
	import type { SettingsData } from "./schema.js";

	let { data }: { data: { form: SuperValidated<SettingsData> } } = $props();
</script>

<SettingsForm validated={data.form} />
```

This example uses normal browser POSTs and works with JavaScript disabled. Superforms reads the
action result from SvelteKit's page state, so rejected values and errors are rendered without a
separate Formsnap submission API.

The fixture app imports Formsnap through its internal `$lib` alias. `Control`, `Label`,
`Description`, `FieldErrors`, `Fieldset` and `Legend` accept an optional `id`; generated IDs
are stable between server rendering and hydration. `Field` and `ElementField` provide context
and snippet values without a root element, and do not accept an `id`. Their optional owned
content slots render description/error containers after the children.

### Progressive enhancement

Enhancement is Superforms', not Formsnap's: attach its `enhance` action and keep the rest of the form
identical. The fixture's
[`/recipes/feedback`](./src/routes/recipes/feedback/+page.svelte) page renders its pending state and
confirmation from Superforms' stores:

```svelte
const form = superForm(untrack(() => data.form), { resetForm: false });
const { form: formData, enhance, message, submitting } = form;
```

```svelte
<form method="POST" use:enhance>
	<!-- The Field/Control markup is the same as the JavaScript-disabled example -->
	<button type="submit" disabled={$submitting}>
		{#if $submitting}Sending…{:else}Send answer{/if}
	</button>
</form>
{#if $message}<output>{$message}</output>{/if}
```

The action picks the outcome: `fail(400, { form })` returns the posted values together with the
errors, and `message(form, "Answer received.")` reports success. Both are read from SvelteKit's page
state, so no submission API is added on top of Superforms.

Two details matter when the same action serves both paths:

- An enhanced submission resolves with HTTP 200 and a failure `ActionResult` in its JSON body, while
  the equivalent native POST is HTTP 400. Assert on the payload when tests cover both.
- Return Superforms' `fail` rather than SvelteKit's when the form can carry `File` values: it removes
  them from the result, which SvelteKit's serialization cannot encode.

### Accessibility associations

Use the owned content slots on `Field`, `ElementField`, or a native `Fieldset` when associations
must be present in server-rendered HTML, including with JavaScript disabled. The scope knows which
containers it will render before it renders any controls; child order does not affect these
associations.

| Prop            | Behavior                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `description`   | A content snippet. Omitted means no description container or reserved ID.                                                  |
| `fieldErrors`   | `true` renders the default error content; a snippet renders custom content. Omitted or `false` renders no error container. |
| `descriptionId` | Optional ID override for an enabled owned description. An ID alone does not render or associate a container.               |
| `fieldErrorsId` | Optional ID override for an enabled owned error region. An ID alone does not render or associate a container.              |

Generated IDs belong to the component instance, not the field path, so repeated fields and multiple
forms have separate targets. Enabled error containers remain mounted when empty, but their IDs enter
`aria-describedby` only while that field has errors. A conditional snippet can be withdrawn by passing
`undefined`; its association is withdrawn too. Changing an enabled region's ID updates both the
container and its controls.

Custom error snippets receive `{ errors, errorProps }`. Render only the content; Formsnap owns the
outer container, its ID, and its `data-fs-field-errors` attributes. Spread `errorProps` onto each error
item to preserve `data-fs-field-error`:

```svelte
<Field {form} name="email">
	<Control>
		{#snippet children({ props })}
			<Label>Email</Label>
			<input type="email" {...props} bind:value={$formData.email} />
		{/snippet}
	</Control>
	{#snippet fieldErrors({ errors, errorProps })}
		{#each errors as error, index (index)}
			<p {...errorProps}>{error}</p>
		{/each}
	{/snippet}
</Field>
```

An `ElementField` uses its local description when present, otherwise its parent's description,
including an owned parent description on the server. A native `Fieldset` places its owned containers
inside the fieldset. Its full-container `child` replacement cannot be combined with an enabled owned
description or error region: choose the native container with owned content, or take responsibility
for the custom container and its associations.

Standalone `Description` and `FieldErrors` remain available for freely composed layouts. Their
automatic associations are registered when the actual elements mount and withdrawn on unmount;
they do not discover targets before server rendering. To associate caller-owned containers without
JavaScript, provide explicit container IDs and native `aria-describedby` on the input, including
an error ID only when its container is rendered and has errors.

Custom standalone `Description`/`FieldErrors` child snippets must spread the supplied props onto their
actual container; those props register the mounted element as well as its ID. The `useFormField`
`descriptionId`/`errorsId` getters declare caller-owned containers: keep those elements rendered
while their IDs are supplied, and return `null` or `undefined` when withdrawing them. Additional mounted
regions can coexist with owned content; their IDs are merged and deduplicated.

`ElementField` uses repeated parent names for native primitive-array submissions (for example,
every `urls[0]`/`urls[1]` control submits as `urls`). Nested object/array submissions require
Superforms' `dataType: "json"`, its `enhance` action, and values bound to the form store; enhancement
serializes that store, not the repeated HTML names. An explicit leaf `name` may also be needed for
Superforms options that identify inputs by their full path, such as `customValidity`.

## Recipes

Every recipe is a page in the fixture app and is exercised by the consumer tests, so the code below
is the code that runs. The sources live under [`src/routes`](./src/routes), and the version notes in
[Requirements](#requirements) apply to all of them.

### Nested data and object arrays

[`/json`](./src/routes/json/+page.svelte) submits a nested object with a keyed array of objects. Use
`dataType: "json"` so Superforms serializes the form store rather than the DOM, and bind every control
to `$formData` so that store stays the source of truth:

```svelte
const form = superForm(untrack(() => data.form), { dataType: "json", resetForm: false });

<Field {form} name="profile.name">
	{#snippet children({ props })}
		<input {...props} bind:value={$formData.profile.name} />
	{/snippet}
</Field>
```

```svelte
<ElementField {form} name={`contacts[${index}].email` as `contacts[${number}].email`}>
	{#snippet children({ props })}
		<input {...props} bind:value={$formData.contacts[index].email} />
	{/snippet}
</ElementField>
```

Nesting needs the enhanced submission above. A native POST without JavaScript sends the repeated HTML
names, which cannot express a nested path, so use [`/arrays`](#primitive-arrays-with-stable-row-identity)
for a form that must work unenhanced.

### Primitive arrays with stable row identity

[`/arrays`](./src/routes/arrays/+page.svelte) keeps a native, JavaScript-free submission while
supporting add, reorder and remove. `ElementField` renders the repeated parent name for those
submissions, and the row key must come from your own list of ids — Superforms replaces row objects
when taint changes, so object identity is not a stable key:

```svelte
<Fieldset {form} name="urls" fieldErrors>
	<Legend>Website URLs</Legend>
	{#each $formData.urls as _, index (ids[index])}
		<ElementField {form} name={`urls[${index}]` as `urls[${number}]`}>
			{#snippet children({ props })}
				<input {...props} bind:value={$formData.urls[index]} />
			{/snippet}
		</ElementField>
	{/each}
</Fieldset>
```

### File uploads

[`/recipes/upload`](./src/routes/recipes/upload/+page.svelte) renders a file input, and the schema
validates the `File` that Superforms parses out of the submission:

```svelte
<Field {form} name="attachment" fieldErrors>
	<Control>
		{#snippet children({ props })}
			<Label>Attachment</Label>
			<input {...props} type="file" />
		{/snippet}
	</Control>
</Field>
```

```ts
attachment: z
	.instanceof(File, { message: "Choose a file." })
	.refine((file) => file.size > 0, "Choose a file.")
	.refine((file) => file.size <= 64_000, "Keep the file at or under 64 kB."),
```

Set `enctype="multipart/form-data"` so the input submits its contents without JavaScript, and return
Superforms' `fail` from the action as described above. `File` values are stripped from the returned
form — a file input cannot be repopulated — so report the file with a `message` instead of echoing it
back. A file input cannot be given a value either, which is why the recipe leaves it unbound.

### Native constraints and custom validity

[`/recipes/constraints`](./src/routes/recipes/constraints/+page.svelte) puts HTML attributes on the
input and repeats the rules in the schema. `Control` supplies `aria-required` from the schema's
constraints, so the announced state and the browser's state agree:

```svelte
<input
	{...props}
	required
	minlength={3}
	maxlength={12}
	pattern="[a-z0-9_]+"
	bind:value={$formData.handle}
/>
```

`customValidity: true` copies each field's server errors onto its control's native validity message,
so the browser's own bubble reports the same problem as the rendered errors:

```svelte
const form = superForm(untrack(() => data.form), { customValidity: true, resetForm: false });
```

Add `data-no-custom-validity` to an input that must keep its own validity message. Its field errors
are still rendered, and its `aria-invalid` is still set; only the native message stays untouched.

### Custom `child` snippets and ref forwarding

[`/recipes/composition`](./src/routes/recipes/composition/+page.svelte) replaces the elements that
`Label`, `Description` and `FieldErrors` render:

```svelte
{#snippet customDescription({ props }: { props: Record<string, unknown> })}
	<small {...props} data-custom="description">Two characters minimum.</small>
{/snippet}

<Description child={customDescription} bind:ref={descriptionRef} />
```

Spread the supplied `props`: they carry the ID and register the mounted node for association, so a
snippet that renders an element but ignores them produces no description. `child` replaces the
element, not the behaviour. A snippet declared at the top level and passed as a prop needs an explicit
parameter type, because it is not an inline child of the component.

`bind:ref` hands back the element the component would otherwise have rendered, so a consumer that
wants the node does not need to query the document for the ID.

### Custom controls with the hooks

The same page builds its range control with the headless hooks instead of the `Control` snippet props:

```svelte
// rating-control.svelte
const control = useFormControl({});
```

```svelte
<input type="range" min="1" max="5" {...control.props} bind:value bind:this={ref} />
```

`useFormControl` reads the surrounding `Control` and `useFormField` reads the surrounding `Field`, so
the widget has to be rendered inside them. The result matches spreading a snippet's `props`; reach for
the hooks when the widget is its own component and cannot receive them as an argument.

### Multiple forms

[`/owned`](./src/routes/owned/owned-form.svelte) renders two independent forms on one page from the
same validated data:

```svelte
const form = superForm(untrack(() => validated), { id: "owned-primary", resetForm: false });
const otherForm = superForm(untrack(() => validated), { id: "owned-secondary" });
```

Give each `superForm` call its own `id`; without one Superforms warns about duplicate form IDs and the
forms begin to share page state. Field IDs belong to the component instance either way, so two forms
never generate the same target.

### Pending and success feedback

[`/recipes/feedback`](./src/routes/recipes/feedback/+page.svelte) is the worked example: `$submitting`
drives the pending state and `$message` renders whatever the action passed to `message(form, …)`.
`onUpdated` is the hook that runs after a result is applied — [`/json`](./src/routes/json/+page.svelte)
counts updated results with it.

### Keyboard and accessibility responsibilities

Formsnap owns the labelling, description and error wiring, and marks its elements with `data-fs-*`
attributes for styling. It does not own interaction:

- Keep one `Control` per control. A generated ID identifies one element, so a group of widgets needs
  its own grouping and labelling rather than several controls sharing one ID.
- Replacing a native element means owning its keyboard behaviour, focus management and ARIA pattern.
  `useFormField` and `useFormControl` expose the field's `errors`, `constraints`, `tainted`,
  `errorsId` and `descriptionId`, and the control's `id` and `props`; the rest of the widget is yours.
- Use `Fieldset` with `Legend` for a group of related controls, and `Label` for a single control.
  A group of custom widgets belongs in a fieldset rather than behind one label aimed at a wrapper.

## Components

`Field`, `ElementField`, `Control`, `Label`, `Description`, `FieldErrors`, `Fieldset` and `Legend`,
plus the `useFormField`/`useFormControl` and `getFormField`/`getFormControl` hooks for custom
widgets. Every component is unstyled and marks its elements with `data-fs-*` attributes for
styling. See [formsnap.dev](https://formsnap.dev) for the full component API.

## Support

- Component API and guides: [formsnap.dev](https://formsnap.dev) (upstream documentation).
- Problems specific to this fork — packaging, supported versions, releases: open an issue on
  [emmorts/formsnap](https://github.com/emmorts/formsnap).
- Behaviour of Superforms itself: [ciscoheat/sveltekit-superforms](https://github.com/ciscoheat/sveltekit-superforms).

## License

MIT. See [LICENSE](./LICENSE); upstream Formsnap is by
[@huntabyte](https://github.com/huntabyte).
