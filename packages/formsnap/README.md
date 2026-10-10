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
