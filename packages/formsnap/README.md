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

Under `sveltekit-superforms` 2.31 and later the zod adapter is typed against the zod v3 API at
`zod/v3`, and it has to be the same zod version Superforms resolves. Import your schema from
`zod/v3`, and keep a single zod version in your dependency tree (pnpm can install a second copy for
Superforms' own dependencies — check with `pnpm why zod`).

## Installation

```bash
npm i @emmorts/formsnap sveltekit-superforms zod
```

## Usage

Superforms sets the form up as usual: define a schema and return the validated form from your load
function. The code below is the fixture app in this repository, which
`pnpm --filter @emmorts/formsnap run check` type-checks, so it stays correct.

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

### 2. Return the form from your load function

```ts
// +page.server.ts
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { settingsSchema } from "./schema.js";

export const load = async () => {
	return {
		form: await superValidate(zod(settingsSchema)),
	};
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

The fixture app in this repository imports the library through its internal `$lib` alias; everywhere
else the code above is exactly what it renders. `Field`, `ElementField`, `Control`, `Label`,
`Description`, `FieldErrors`, `Fieldset` and `Legend` all accept an `id`; when you omit it the
component generates one that is identical in the server-rendered HTML and after hydration, so the
markup can be cached and the ids stayed stable in the example above.

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
