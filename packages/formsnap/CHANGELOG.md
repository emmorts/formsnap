# formsnap

## Unreleased

### Compatibility

- Raise the minimum supported Svelte version to 5.30.2, matching `svelte-toolbelt` 0.10.6.
  Superforms 3.0.0 additionally requires Svelte 5.56.4. The release version and classification
  remain a maintainer decision.

### Features

- Add opt-in `description` and `fieldErrors` content slots to `Field`, `ElementField`, and native
  `Fieldset`, with scope-owned hydration-stable IDs and optional `descriptionId`/`fieldErrorsId`
  overrides. Controls reference rendered instructions and current errors in server-rendered HTML
  without mounting effects or rendering consumer snippets twice.
- Preserve owned parent descriptions for `ElementField` inheritance. Place native `Fieldset` owned
  regions inside its container; reject combining enabled owned slots with its full-container `child`
  replacement in public types and at runtime.

### Fixes

- Generate hydration-stable component IDs and honor explicit control IDs in server-rendered HTML.
- Track description, error, and control-ID contributions by owner. Releasing or destroying one
  owner preserves other contributions, removes stale references, and restores inherited descriptions
  or control IDs.
- Register `Description` and `FieldErrors` through their actual mounted elements, including custom
  child snippets. Custom containers must spread their supplied props; unrelated document IDs are
  no longer mistaken for those containers.
- Resolve nested and array snippet values consistently across `Field`, `ElementField`, and
  `Fieldset`. Preserve literal top-level keys containing path delimiters and include `undefined`
  in snippet types when traversing optional or nullable ancestors.
- Resolve array constraints using schema paths without bracket indices, while preserving literal
  top-level schema keys and numeric object keys. Deduplicate description/error IDs in the final
  `aria-describedby` value.
- Correct the scoped-package quickstart, version guidance, support routing, and native submission
  example. Use owned slots for server-rendered associations; document client-only automatic
  standalone regions and the native `aria-describedby` escape hatch for caller-owned containers.

### Verification

- Add real SvelteKit browser hydration, no-JavaScript repeated-name array submissions, enhanced JSON
  validation, stable keyed row interactions, association ownership/lifecycle, owned SSR regions,
  conditional content, custom error snippets, and public type cases.
- Isolate optimizer caches between component tests and the real fixture app. Allocate the fixture
  port dynamically and close its server after setup failures and test completion.
- Cover the Superforms 2 and 3 Svelte minimums plus current versions in CI; install Chromium in the
  release workflow before running consumer tests.

## 2.1.1 (2026-10-09)

No functional change. This release exists to exercise the release pipeline end to end: the tag
`v2.1.1` is picked up by GitHub Actions, which type-checks, tests, builds and publishes the package
over npm trusted publishing, then opens this GitHub release from this changelog section.

## 2.1.0

Forked as `@emmorts/formsnap` from `svecosystem/formsnap` 2.0.1, which has been
unmaintained since 2025-04. Published from https://github.com/emmorts/formsnap.

### Minor Changes

- Support `sveltekit-superforms` 3, whose `FormPathLeaves<T>` is no longer
  assignable to `FormPath<T>`. The internal generics are now constrained on the
  union of the two; the public component props keep their narrower types.
- Widened the `sveltekit-superforms` peer range to `^2.19.0 || ^3.0.0`.

## 2.0.1

### Patch Changes

- fix: constraints on nested properties ([#216](https://github.com/svecosystem/formsnap/pull/216))

## 2.0.0

### Major Changes

- Formsnap v2 - See [Migration Guide](https://formsnap.dev/docs/v2-migration-guide) ([#177](https://github.com/svecosystem/formsnap/pull/177))

## 2.0.0-next.1

### Patch Changes

- fix: issue with derived updating ([#185](https://github.com/svecosystem/formsnap/pull/185))

## 2.0.0-next.0

### Major Changes

- Formsnap v2 (Svelte) prerelease ([#179](https://github.com/svecosystem/formsnap/pull/179))

## 1.0.1

### Patch Changes

- chore: support Svelte 5 as a peer dependency ([#173](https://github.com/svecosystem/formsnap/pull/173))

## 1.0.0

### Major Changes

- v1 Stable release 🎉 ([#161](https://github.com/svecosystem/formsnap/pull/161))

### Patch Changes

- Fixed a bug where `FieldErrors` wouldn't render errors for nested fields with `dataType: 'json'` ([#159](https://github.com/svecosystem/formsnap/pull/159))

## 0.5.1

### Patch Changes

- Fixed bug where `FieldErrors` wouldn't render errors for nested `dataType: "json"` `ElementField`s ([#151](https://github.com/svecosystem/formsnap/pull/151))

## 0.5.0

### Minor Changes

- Rewrite entire library - see https://formsnap.dev ([#131](https://github.com/huntabyte/formsnap/pull/131))

## 0.4.4

### Patch Changes

- Adds support for superforms {\_errors?: string[]} syntax ([#129](https://github.com/huntabyte/formsnap/pull/129))

## 0.4.3

### Patch Changes

- Changes input type to "hidden" in hidden form control inputs ([#121](https://github.com/huntabyte/formsnap/pull/121))

## 0.4.2

### Patch Changes

- fix: apply correct `data-fs` attributes to elements ([#96](https://github.com/huntabyte/formsnap/pull/96))

## 0.4.1

### Patch Changes

- Fix: Add missing attributes for SSR ([#89](https://github.com/huntabyte/formsnap/pull/89))

## 0.4.0

### Minor Changes

- Feat: Controlled `SuperForm` usage ([#83](https://github.com/huntabyte/formsnap/pull/83))

## 0.3.1

### Patch Changes

- Fix (#79): Bug with the `options` prop of the `<Form.Root />` component ([#81](https://github.com/huntabyte/formsnap/pull/81))

## 0.3.0

### Minor Changes

- New Component: `<Form.Control />` ([#75](https://github.com/huntabyte/formsnap/pull/75))

### Patch Changes

- Fix: Returned values ([#78](https://github.com/huntabyte/formsnap/pull/78))

## 0.2.1

### Patch Changes

- Fix lack of reactivity of `data-fs-error` ([#66](https://github.com/huntabyte/formsnap/pull/66))

- Fix the typing for tag ([#67](https://github.com/huntabyte/formsnap/pull/67))

- Fix: Reactivity ([#72](https://github.com/huntabyte/formsnap/pull/72))

- fix: export get-form-schema function in helpers/index.ts ([#64](https://github.com/huntabyte/formsnap/pull/64))

## 0.2.0

### Minor Changes

-   - Add utility function `getFormSchema()` ([#62](https://github.com/huntabyte/formsnap/pull/62))

## 0.1.4

### Patch Changes

- Add FormValidation to Field.config.schema's type ([#52](https://github.com/huntabyte/formsnap/pull/52))

## 0.1.3

### Patch Changes

- Add data attributes for styling ([#49](https://github.com/huntabyte/formsnap/pull/49))

- Fix handling of refined zod schemas so as not to throw false type errors. ([#47](https://github.com/huntabyte/formsnap/pull/47))

## 0.1.2

### Patch Changes

- Forward for events to `<Form.Root />` component ([#38](https://github.com/huntabyte/formsnap/pull/38))

## 0.1.1

### Patch Changes

- b31af0f: Fix: Set Form Context for `getForm`

## 0.1.0

### Minor Changes

- 83dcbbd: - Add `getForm` helper
    - Fix bug which was creating large `.d.ts` files and crashing editors

## 0.0.9

### Patch Changes

- 709b7ab: - Add `method="POST"` by default to `<Form.Root />`

## 0.0.8

### Patch Changes

- 48eea47: - add `formStore` to `<Form.Root />` slot props

## 0.0.7

### Patch Changes

- 4bc5459: Fix: Value typing

## 0.0.6

### Patch Changes

- bfa0520: Add `tag` prop to `Validation` & `Description`

## 0.0.5

### Patch Changes

- 2a857e1: Fix: `<Form.Root />` slot prop types

## 0.0.4

### Patch Changes

- 6c46a7f: export additional types

## 0.0.3

### Patch Changes

- 0801f7d: Add the `handlers` object containing the event handler helpers as well as the `setValue` helper function to the `getFormField` return object.
- 748f8e8: #### Add a `getFormField` helper function

    The `getFormField` helper function must be called upon component initialization and provides some useful stores, actions, etc. when composing your own forms.
    For example, if I wanted to create a reusable `Form.Label` with conditional styles applied to it depending on the error state of the field, I could do something like this:

    ```svelte
    <!-- CustomLabel.svelte -->
    <script lang="ts">
    	import { Form, getFormField } from "formsnap";
    	const { errors } = getFormField();
    </script>

    <Form.Label class={$errors ? "text-red-500" : "text-gray-800"}>
    	<slot />
    </Form.Label>
    ```

    It returns the following type:

    ```ts
    export type FormFieldContext = {
    	name: string;
    	ids: {
    		input: string;
    		description: string;
    		validation: string;
    	};
    	errors: Writable<string[] | undefined>;
    	value: Writable<unknown>;
    	hasDescription: Writable<boolean>;
    	hasValidation: Writable<boolean>;
    	attrStore: AttrStore;
    	actions: ActionsObject;
    };
    ```

## 0.0.2

### Patch Changes

- 8596892: Exposes the following additional values from superforms as slot props via the `<Form.Root/>` component.

    - `allErrors`
    - `delayed`
    - `errors`
    - `submitting`
    - `tainted`
    - `timeout`
    - `validate`
    - `posted`
    - `fields`
    - `message`
    - `options`
    - `formId`
    - `restore`
    - `capture`
    - `constraints`

## 0.0.1

### Patch Changes

- 69b7e73: initial release
