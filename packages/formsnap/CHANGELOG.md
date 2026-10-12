# Changelog

`@emmorts/formsnap` is a fork of [svecosystem/formsnap](https://github.com/svecosystem/formsnap),
created because the original repository has not been maintained since April 2025.
Versions 2.1.0 and later belong to this fork; earlier entries are upstream history.

## Unreleased

## 2.3.0 (2026-10-12)

Additive. The root entry point's imports, declarations and runtime behaviour are unchanged, so an
existing Superforms consumer has nothing to migrate. The new `./remote` subpath is claimed only for
`@sveltejs/kit` `^3.0.1` with `experimental.remoteFunctions`, and the root entry point's Superforms
`^2.19.0 || ^3.0.0` and Svelte `^5.30.2` requirements are unchanged. The one install-visible
difference is described under Changed below.

### Added

- Publish a `@emmorts/formsnap/remote` entry point that presents a native SvelteKit remote form, with
  no Superforms in its graph. `RemoteField`, `RemoteFieldset` and `RemoteControl` read the selected Kit
  field's `value()`, `issues()`, `touched()` and `dirty()`, and share `Label`, `Description`,
  `FieldErrors` and `Legend` with the root entry point. Kit keeps the control's transport name and
  `aria-invalid`, so the props from `field.as(...)` supply both; `RemoteControl` adds the associations,
  container IDs and `data-fs-*` attributes, and required state is exactly the `constraints` a caller
  passes because Kit's `as(...)` derives none from a schema. `useRemoteFormField` gives a custom
  widget its original typed Kit field and presentation state; `useRemoteField` installs a scope and
  `getRemoteField` reads that state.
- Document `@sveltejs/kit` `^3.0.1` with `experimental.remoteFunctions` for the remote entry.
  Kit 3.0.1 and Svelte 5.57.2 are the tested baseline; Kit 3 requires Svelte `^5.57.1`.
  A changed Kit version must pass the `remote` CI job before the documented baseline changes.
  The caret range is not evidence that every later Kit release was tested.

### Changed

- Mark `sveltekit-superforms` optional so a remote-only consumer need not install it. The root entry
  still requires Superforms explicitly, with its existing peer range and declarations.
- Keep Kit requirements backend-specific and documented, not a package-wide peer. Even an optional
  Kit 3 peer rejects existing root Kit 2/Superforms 2 applications. Remote support remains `^3.0.1`;
  removing the global peer does not claim remote compatibility with Kit 2.
- Build root compatibility artifacts at the locked workspace baseline, then install them in isolated
  Kit 2 consumers for the existing minimum, Superforms 3.0.0 and current matrix entries. Each consumer
  checks its actual app and published types, renders a classic-action form and submits invalid and
  valid inputs natively. The full source/browser fixture suite remains in verify and remote jobs.

### Fixed

- Copy structured remote issues and explicit constraints before exposing presentation metadata, so
  consumers cannot mutate backend state through those views. Keep the original Kit value and field.
- Keep unused selected values and interaction state lazy in remote snippet getters.
- Reject backend-specific hooks used inside the wrong field provider rather than casting its state.
- Use the typed `useRemoteFormField` hook in the keyed-instance quantity stepper.
- Reject inherited keyed-instance names before reading server-owned record limits.
- Keep an accepted command result and receipt when its subsequent query refresh fails; report that
  refresh separately. Clear stale command feedback at submission and render exclusive remote outcomes.
- Hide a previous accepted result from a subsequent preflight-rejection announcement.
- Reject `RemoteControl` inside a Superforms field instead of dropping the transport name.
- Type the documentation highlighter callback under the strict documentation TypeScript config.

### Docs

- Document the remote path on its own page, including the empty-transport, missing-attachment, stale
  snapshot and double-enhancement cases, and state that Superforms' serialization `transport` option
  and its JSON mode are not remote-form bridges.
- Add the `./remote` entry point to the installation requirements as its own row, and point the remote
  functions guide at it.

[Full changelog](https://github.com/emmorts/formsnap/compare/v2.2.7...v2.3.0)

## 2.2.7 (2026-10-12)

### Docs and tests

- Render page descriptions as inline Markdown, so `code` spans, emphasis and links in a description
  are formatted instead of printed literally. The meta description and the search index keep the
  plain wording.
- Replace the standalone search page with a search palette available on every page: the header
  trigger or `⌘K`/`Ctrl+K` opens a dialog with combobox semantics, results grouped by page,
  highlighted matches and arrow-key navigation. Matching tolerates typos, identifier-style queries
  such as `useformfield` or `usef`, and multi-word queries where only some words match.
- Keep the search palette hidden visually and from assistive technology when closed. Preserve
  native Home/End editing and leave input-method composition keystrokes untouched.
- Match typos in joined identifiers without joining arbitrary prose, scan past invalid earlier
  matches, preserve full Unicode highlight spans, and keep matched text inside search snippets.
- Decode Markdown character references consistently in page descriptions, metadata and indexed
  descriptions while preserving literal code and escapes. Allow only HTTP, HTTPS, email, telephone
  and relative link destinations; render other link labels without an anchor.

[Full changelog](https://github.com/emmorts/formsnap/compare/v2.2.6...v2.2.7)

## 2.2.6 (2026-10-11)

### Changed

- Include `undefined` in snippet values selected through variable-length arrays, including
  object descendants and nested arrays. Required tuple positions and exact literal keys retain
  their precise types. Consumers must handle absent items before accessing their values.
- Preserve structured Superforms message types through `useFormField<T, U, M>` and its exported
  `UseFormFieldResult<T, U, M>` contract. Optional SDK methods on lightweight form wrappers now
  retain their upstream signatures rather than accepting arbitrary values.

### Docs and tests

- Let the mobile navigation panel scroll independently of the page, so every link is reachable
  without first scrolling the current page to its end.
- Tighten the live examples: the documentation's prose element rhythm no longer reaches into a
  demo box, and each field's label, input, description and errors share one tight stack while
  the surrounding form separates one field from the next.
- Hide an empty `## Unreleased` section on the changelog page and its "on this page" rail,
  using the same emptiness rule as the release tooling.
- Add a static, section-level documentation search with keyboard navigation and shareable queries,
  a dedicated headless-hook reference, and a migration/troubleshooting guide.
- Add runnable client-only array, linked-error-summary and Bits UI select examples. Each explicitly
  distinguishes local validation from server submission and persistence.
- Add a conditional Contact → Details → Review recipe with step validation, retained drafts,
  accessible error links, hidden-step transport, final server validation and a native POST fallback.
- Replace the mobile navigation overlay with a native modal menu supporting Escape, contained
  keyboard focus and trigger focus restoration; retain navigation without JavaScript.
- Report client validation rather than nonexistent signup/email delivery in the landing demo.

### Contributor tooling

- Align the checkout on Node.js 24 and pnpm 9.14.4. Remove conflicting package-local pnpm
  declarations without changing the published library's Node.js requirement.

[Full changelog](https://github.com/emmorts/formsnap/compare/v2.2.5...v2.2.6)

## 2.2.5 (2026-10-11)

### Docs and tests

- Improve primitive-array editing after validation: preserve row error/taint identity during
  mutations, remove stale targets, recover keyboard focus and report changes in one polite region.
  Keep native submissions and validate enhanced corrections through Superforms.
- Add native radio/multiple-select and Bits UI composite-select recipes, covering server
  associations, keyboard behavior, disabled transport, reset and native/enhanced submissions.
  The widget dependency is dev-only and preserves the supported Svelte minimum.

### Release tooling

- Recover partial publication by verifying existing npm tarball bytes before skipping publication
  and completing the missing GitHub release. Matching completed reruns are read-only; artifact,
  release-metadata and lookup failures stop without overwriting published content.

[Full changelog](https://github.com/emmorts/formsnap/compare/v2.2.4...v2.2.5)

## 2.2.4 (2026-10-11)

### Docs and tests

- Rebuild the documentation site as a prerendered SvelteKit app: introduction, installation and
  quickstart, progressive-enhancement and accessibility guides, a reference page for every
  component, nine recipes and the changelog, with a live Formsnap form on the landing page.
  Published to [emmorts.github.io/formsnap](https://emmorts.github.io/formsnap/).
- Build and serve the site from the repository root with `pnpm docs:build` and `pnpm docs:dev`;
  both build `@emmorts/formsnap` first, because the site resolves the workspace package through
  its built output.

[Full changelog](https://github.com/emmorts/formsnap/compare/v2.2.3...v2.2.4)

## 2.2.3 (2026-10-11)

### Fixed

- Report selected object and array taint when any descendant is marked true, without counting
  unrelated fields or all-false subtrees.
- Keep each `Label`'s ID and ref local, and resolve the headless naming target when rendering so
  server HTML, hydration and client updates agree. Attribute updates preserve naming precedence;
  removing the active label or stopping its custom child from spreading props restores a surviving
  or default name.

### Docs and tests

- Define the mounted form-owner lifetime and cover keyed replacement of complete field subtrees,
  including nested contexts, metadata and headless hooks.
- Add a native/enhanced form-wide error-summary recipe with root errors, keyboard links,
  conditional targets, one announcement region per form and isolated multiple forms. Repeated
  identical rejections refresh the announcement; calendar validation rejects malformed dates and
  orders extended years correctly.

[Full changelog](https://github.com/emmorts/formsnap/compare/v2.2.2...v2.2.3)

## 2.2.2 (2026-10-11)

### Fixed

- Forward `data-fs-error` to custom `Fieldset` child containers, matching the native container
  as field errors appear and clear.
- Keep `ElementField` snippet constraints isolated from Superforms stores, like `Field` and
  `Fieldset`.
- Report the required field or control parent when components or headless hooks lack their context.

### Changed

- Read field errors and taint without cloning whole-form trees; copy only the selected constraints.

### Docs and tests

- Add a runnable native/custom group recipe covering role-based control naming, refs, keyboard
  activation, disabled controls and transport, server-rendered associations and submission errors.
- Cover same-object metadata updates, nested and array path changes, metadata mutation isolation
  and missing-provider diagnostics during real SvelteKit server requests.

[Full changelog](https://github.com/emmorts/formsnap/compare/v2.2.1...v2.2.2)

## 2.2.1 (2026-10-10)

### Fixed

- Include `CHANGELOG.md` in the npm package so the README's changelog link resolves.

[Full changelog](https://github.com/emmorts/formsnap/compare/v2.2.0...v2.2.1)

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
