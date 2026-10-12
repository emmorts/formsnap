# Formsnap

[![npm version](https://flat.badgen.net/npm/v/@emmorts%2Fformsnap?color=blue)](https://npmjs.com/package/@emmorts/formsnap)
[![license](https://flat.badgen.net/github/license/emmorts/formsnap?color=blue)](./LICENSE)
[![CI](https://github.com/emmorts/formsnap/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/emmorts/formsnap/actions/workflows/ci.yml)

Accessible, unstyled form components for SvelteKit and
[sveltekit-superforms](https://github.com/ciscoheat/sveltekit-superforms).
Formsnap handles labels, descriptions, errors and ARIA relationships. Superforms handles
validation, submission and form state.

`@emmorts/formsnap` is a fork of [svecosystem/formsnap](https://github.com/svecosystem/formsnap),
created because the original repository has not been maintained since April 2025.
This fork continues maintenance and adds Superforms 3 support.

## Installation

```bash
npm install @emmorts/formsnap sveltekit-superforms zod
```

For the current source:

| Dependency | Supported versions    |
| ---------- | --------------------- |
| Svelte     | `^5.30.2`             |
| Superforms | `^2.19.0 \|\| ^3.0.0` |

Superforms 3.0.0 requires Svelte `^5.56.4`. Other schema libraries work through Superforms adapters.
Check the selected package release's peer dependencies when upgrading.

## Usage

Import components from the scoped package:

```ts
import { Control, Field, Label } from "@emmorts/formsnap";
```

Follow the [SvelteKit quickstart](./packages/formsnap/README.md#usage) for the schema, server
load/action and form component. If migrating from upstream, replace `formsnap` in imports with
`@emmorts/formsnap`.

Components: `Field`, `ElementField`, `Control`, `Label`, `Description`, `FieldErrors`, `Fieldset`
and `Legend`. Headless hooks support custom controls. Style components with `data-fs-*` attributes.

## Changes in this fork

Released in 2.1.0: Superforms 2 and 3 support under the `@emmorts/formsnap` package name.

Changes since 2.1.1 (see the changelog for release status):

- IDs stay stable across server rendering and hydration. Explicit control IDs are respected.
- Description and error associations update correctly when content mounts, unmounts or changes.
- Nested fields and arrays resolve values and constraints correctly, including optional paths.
- Variable-length array snippet values include `undefined` when the selected item is absent.
- Headless field hooks preserve structured Superforms messages and SDK method signatures.
- Selected field taint includes true descendants without counting unrelated fields.
- Multiple labels keep distinct IDs and refs; headless naming follows active label ownership.
- `description` and `fieldErrors` slots on `Field`, `ElementField` and native `Fieldset` associate
  content before hydration and without JavaScript.
- `live` on `FieldErrors` and `fieldErrorsLive` on owning fields accept `"assertive"`, `"polite"`
  or `"off"`. The default remains `"assertive"`.
- Tested recipes cover uploads, arrays, custom controls, native validation, submission feedback,
  form-wide error summaries and conditional multi-step forms.

See the [changelog](./packages/formsnap/CHANGELOG.md) for details.

## Documentation

- [Documentation site](https://emmorts.github.io/formsnap/): searchable guides, component and
  headless-hook reference, migration help, runnable recipe demos and the changelog. Built from
  [`docs/`](./docs), a SvelteKit app deployed to GitHub Pages.
- [Upstream API reference](https://formsnap.dev): the original component API.
- [Recipe source](./packages/formsnap/src/routes): complete SvelteKit examples exercised by browser tests.

Build the site locally with `pnpm docs:dev` (it builds `@emmorts/formsnap` first, then serves the
docs app on Vite). `pnpm docs:build` writes the static site to `docs/build`.

Search is available on every page: the header button or `⌘K`/`Ctrl+K` opens a palette that matches
in the browser against a prerendered section index, tolerates typos and identifier-style queries
such as `useformfield` or `useformfiled`, and links straight to the matching section. Arrow keys
select results and Enter opens them; Home/End keep their normal text-editing behavior.
The live demos validate locally; they do not save data or send email. Complete server/native
recipes remain in the fixture app.

## Support

Report fork bugs on [emmorts/formsnap](https://github.com/emmorts/formsnap/issues).
Report Superforms bugs on [ciscoheat/sveltekit-superforms](https://github.com/ciscoheat/sveltekit-superforms/issues).

## Contributing

Open an issue with reproduction steps or submit a pull request with a regression test for a bug fix.
The checkout and CI use Node.js 24 and pnpm 9.14.4; `.nvmrc` and the root package-manager pin
select that toolchain. These development requirements do not raise the published library's
consumer Node.js requirement. From the repository root:

```bash
nvm use
pnpm install --frozen-lockfile
pnpm --filter @emmorts/formsnap exec playwright install --with-deps chromium
pnpm lint
node --test scripts/release.test.mjs scripts/publish-release.test.mjs
pnpm --filter @emmorts/formsnap run check
pnpm --filter @formsnap/docs run check
pnpm --filter @formsnap/docs test
pnpm test:package
pnpm --filter @emmorts/formsnap run package
pnpm docs:build
```

### Releases (maintainers)

1. Keep developer-facing entries under `Unreleased` in [the changelog](./packages/formsnap/CHANGELOG.md).
2. On an up-to-date `main`, run `npm run release -- <version>`. It generates the dated version
   section and comparison link, bumps the manifest, commits, and atomically pushes `main` and
   an annotated tag.
3. GitHub Actions verifies and publishes `@emmorts/formsnap` through npm trusted publishing with
   provenance, then creates the GitHub release from the generated changelog section.

If npm publication succeeds but GitHub release creation fails, rerun the failed Release workflow
for the same tag. It packs the built package once, compares an existing npm tarball's actual
SHA-512 hash to that output, and skips publication only when the artifacts match. A matching
public GitHub release is left unchanged; a missing one is created from the changelog notes.

Lookup/authentication failures are not treated as absence. Different npm bytes or incompatible
GitHub release metadata stop recovery before mutation; investigate rather than overwrite them.
The workflow publishes the exact packed file with provenance and removes its temporary pack.
Local recovery tests use loopback registry/GitHub fixtures and never publish remotely.

This checkout's `gh` defaults can resolve to upstream. Always pass the fork explicitly, for example:

```bash
gh run list --repo emmorts/formsnap --workflow release.yml
```

## License and credits

[MIT](./LICENSE). Original library by [@huntabyte](https://github.com/huntabyte) and
[contributors](https://github.com/svecosystem/formsnap/graphs/contributors).
[Support the original author](https://github.com/sponsors/huntabyte).
