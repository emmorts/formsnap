# Changelog

`@emmorts/formsnap` is a fork of [svecosystem/formsnap](https://github.com/svecosystem/formsnap),
created because the original repository has not been maintained since April 2025.
Versions 2.1.0 and later belong to this fork; earlier entries are upstream history.

## Unreleased

### Fixed

- Include `CHANGELOG.md` in the npm package so the README's changelog link resolves.

## 2.2.0 (2026-10-10)

### Compatibility

- Correct the advertised Svelte minimum to `^5.30.2`, already required by `svelte-toolbelt`.
  Superforms 3.0.0 requires Svelte `^5.56.4`.

### Added

- `description` and `fieldErrors` slots on `Field`, `ElementField` and native `Fieldset`.
  Controls reference descriptions and current errors before hydration and without JavaScript.
  Override generated IDs with `descriptionId` and `fieldErrorsId`. Native `Fieldset` cannot
  combine enabled slots with a full-container `child` replacement.
- `live` on `FieldErrors` and `fieldErrorsLive` on owning fields: `"assertive"` (default),
  `"polite"` or `"off"`. The policy changes announcements, not associations or `aria-invalid`.
  On `FieldErrors`, precedence is `live` > spread `aria-live` > default.

### Fixed

- Keep generated IDs stable across hydration and respect explicit control IDs in server-rendered HTML.
- Remove stale description, error and control-ID references without removing another owner's
  associations. Restore inherited descriptions and IDs when overrides disappear.
- Register standalone `Description` and `FieldErrors` against their mounted elements, including
  custom snippets. Automatic standalone associations remain client-only.
- Resolve nested and array values and constraints consistently. Preserve literal keys, handle
  optional or nullable parents in snippet types, and deduplicate `aria-describedby` IDs.

### Docs and tests

- Add a complete Superforms quickstart and tested recipes for nested data, arrays, uploads,
  native validation, custom controls, multiple forms, submission feedback and error announcements.
- Publish the fork documentation and changelog on GitHub Pages.
- Generate dated changelog sections and comparison links from `Unreleased`. Create the GitHub
  release automatically from those notes after npm publication.
- Test server rendering, hydration, JavaScript-free and enhanced submissions, dynamic associations
  and public types across Superforms 2 and 3. Manual screen-reader checks remain pending.

[Full changelog](https://github.com/emmorts/formsnap/compare/v2.1.1...v2.2.0)

## 2.1.1 (2026-10-09)

No functional changes. Verify npm trusted publishing and GitHub release generation.

## 2.1.0

Fork upstream 2.0.1 as `@emmorts/formsnap`.

- Support Superforms 3 while keeping the existing public field-path types.
- Expand the Superforms peer range to `^2.19.0 || ^3.0.0`.

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
