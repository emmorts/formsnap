# Formsnap

[![npm version](https://flat.badgen.net/npm/v/@emmorts%2Fformsnap?color=blue)](https://npmjs.com/package/@emmorts/formsnap)
[![license](https://flat.badgen.net/github/license/emmorts/formsnap?color=blue)](./LICENSE)

Accessible, unstyled form components for SvelteKit and
[sveltekit-superforms](https://github.com/ciscoheat/sveltekit-superforms).
Formsnap handles labels, descriptions, errors and ARIA relationships. Superforms handles
validation, submission and form state.

`@emmorts/formsnap` is a fork of [svecosystem/formsnap](https://github.com/svecosystem/formsnap),
created because the original repository has not been maintained since April 2025.
This fork continues maintenance and adds Superforms 3 support.

## Changes in this fork

Released in 2.1.0: Superforms 2 and 3 support under the `@emmorts/formsnap` package name.

On `main`, not yet released:

- IDs stay stable across server rendering and hydration. Explicit control IDs are respected.
- Description and error associations update correctly when content mounts, unmounts or changes.
- Nested fields and arrays resolve values and constraints correctly, including optional paths.
- `description` and `fieldErrors` slots on `Field`, `ElementField` and native `Fieldset` associate
  content before hydration and without JavaScript.
- `live` on `FieldErrors` and `fieldErrorsLive` on owning fields accept `"assertive"`, `"polite"`
  or `"off"`. The default remains `"assertive"`.
- Tested recipes cover uploads, arrays, custom controls, native validation and submission feedback.

See the [changelog](./packages/formsnap/CHANGELOG.md) for details.

## Installation

```bash
npm i @emmorts/formsnap sveltekit-superforms zod
```

Requires Svelte `^5.30.2` and Superforms `^2.19.0 || ^3.0.0`.
Superforms 3.0.0 requires Svelte `^5.56.4`. Other schema libraries work through Superforms adapters.

## Usage and docs

Start with the [quickstart](./packages/formsnap/README.md). Use `@emmorts/formsnap` in imports
instead of `formsnap`.

- [Fork documentation](https://emmorts.github.io/formsnap/): setup, APIs added by this fork and recipes.
- [Upstream API reference](https://formsnap.dev): the original component API.
- [Recipe source](./packages/formsnap/src/routes): complete SvelteKit examples exercised by browser tests.

Components: `Field`, `ElementField`, `Control`, `Label`, `Description`, `FieldErrors`, `Fieldset`
and `Legend`. Headless hooks support custom controls. Style components with `data-fs-*` attributes.

Report fork bugs on [emmorts/formsnap](https://github.com/emmorts/formsnap/issues).
Report Superforms bugs on [ciscoheat/sveltekit-superforms](https://github.com/ciscoheat/sveltekit-superforms/issues).

## License and credits

[MIT](./LICENSE). Original library by [@huntabyte](https://github.com/huntabyte) and
[contributors](https://github.com/svecosystem/formsnap/graphs/contributors).
[Support the original author](https://github.com/sponsors/huntabyte).

## Releasing

1. Add a version section to [the changelog](./packages/formsnap/CHANGELOG.md).
2. Run `npm run release -- <version>` to check, bump, commit, tag and push.
3. GitHub Actions verifies and publishes `@emmorts/formsnap`, then creates release notes from that section.
