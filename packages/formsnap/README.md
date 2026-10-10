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
	import { Control, Description, Field, FieldErrors, Label } from "@emmorts/formsnap";
	import type { SettingsData } from "./schema.js";

	let { validated }: { validated: SuperValidated<SettingsData> } = $props();

	// `superForm` reads the initial validation data once, so the read is deliberately untracked.
	const form = superForm(untrack(() => validated));
	const { form: formData } = form;
</script>

<form method="POST">
	<Field {form} name="email">
		<Control id="email-input">
			{#snippet children({ props })}
				<Label>Email</Label>
				<input type="email" {...props} bind:value={$formData.email} />
			{/snippet}
		</Control>
		<Description>We'll email you about your account.</Description>
		<FieldErrors />
	</Field>

	<Field {form} name="bio">
		<Control>
			{#snippet children({ props })}
				<Label>Bio</Label>
				<textarea {...props} bind:value={$formData.bio}></textarea>
			{/snippet}
		</Control>
		<Description>Tell us about yourself.</Description>
		<FieldErrors />
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
and snippet values, not HTML elements, and do not accept an `id`.

### Accessibility associations

Labels and explicit control IDs are present in server-rendered HTML. Description and error
associations are registered on the client when their elements mount and withdrawn on unmount.
Rendering `Description` or `FieldErrors` after a control cannot add `aria-describedby` to HTML
the server has already emitted. If the association must work without JavaScript, give the
containers explicit IDs and set native `aria-describedby` on the input yourself, including the
error ID only when the error container exists and has errors.

Custom `Description`/`FieldErrors` child snippets must spread the supplied props onto their actual
container; those props register the mounted element as well as its ID. The `useFormField`
`descriptionId`/`errorsId` getters declare caller-owned containers: keep those elements rendered
while their IDs are supplied, and return `null` or `undefined` when withdrawing them.

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
