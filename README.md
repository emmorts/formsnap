# Formsnap

<!-- automd:badges license name="formsnap" color="blue" github="svecosystem/formsnap" -->

[![npm version](https://flat.badgen.net/npm/v/@emmorts%2Fformsnap?color=blue)](https://npmjs.com/package/@emmorts/formsnap)
[![npm downloads](https://flat.badgen.net/npm/dm/@emmorts%2Fformsnap?color=blue)](https://npmjs.com/package/@emmorts/formsnap)
[![license](https://flat.badgen.net/github/license/svecosystem/formsnap?color=blue)](https://github.com/svecosystem/formsnap/blob/main/LICENSE)

<!-- /automd -->

The goal of this library is to make working with the already incredible [sveltekit-superforms](https://github.com/ciscoheat/sveltekit-superforms) even more pleasant, by wrapping it with accessible form components.

This repository is the maintained fork [`@emmorts/formsnap`](https://github.com/emmorts/formsnap) of
[`formsnap`](https://github.com/svecosystem/formsnap). The components follow the upstream API
documented at [formsnap.dev](https://formsnap.dev); this fork keeps the package published and the
supported dependency range current.

## Installation

```bash
npm i @emmorts/formsnap sveltekit-superforms <your-schema-library>
```

The supported versions match the published peer range:

| Dependency             | Supported range                                |
| ---------------------- | ---------------------------------------------- |
| `svelte`               | `^5.30.2` — required by `svelte-toolbelt` 0.10 |
| `sveltekit-superforms` | `^2.19.0 \|\| ^3.0.0`                          |

These ranges are not an unrestricted cross-product: Superforms 3.0.0 requires Svelte
`^5.56.4`. Use Svelte 5.30.2 or later with Superforms 2, and satisfy Superforms' own Svelte
peer requirement when choosing Superforms 3.

## Usage

[`packages/formsnap/README.md`](./packages/formsnap/README.md) holds the canonical quickstart:
a schema, a load function and action, the form component, and the page that renders it. The fixture
app under [`packages/formsnap/src/routes`](./packages/formsnap/src/routes) is type-checked and
exercised by the consumer tests.

You still handle the Superforms setup yourself — define a schema, return `superValidate(...)` from
your load function, call `superForm` in your component — and Formsnap adds the accessible labelling,
description and error markup plus the ARIA relationships for each field.

## Components

`Field`, `ElementField`, `Control`, `Label`, `Description`, `FieldErrors`, `Fieldset` and `Legend`,
plus the `useFormField`/`useFormControl` and `getFormField`/`getFormControl` hooks for custom
widgets. Components are unstyled and mark their elements with `data-fs-*` attributes for styling.

## Support

- Component API and guides: [formsnap.dev](https://formsnap.dev) (upstream documentation).
- Problems specific to this fork — packaging, supported versions, releases: open an issue on
  [emmorts/formsnap](https://github.com/emmorts/formsnap).
- Behaviour of Superforms itself: [ciscoheat/sveltekit-superforms](https://github.com/ciscoheat/sveltekit-superforms).

## Sponsors

Upstream Formsnap is supported by the following beautiful people/organizations:

<p align="center">
  <a href="https://github.com/sponsors/huntabyte">
    <img src='https://cdn.jsdelivr.net/gh/huntabyte/static/sponsors.svg' alt="Logos from Sponsors" />
  </a>
</p>

## License

<!-- automd:contributors license=MIT author="huntabyte" github="svecosystem/formsnap" -->

Published under the [MIT](https://github.com/svecosystem/formsnap/blob/main/LICENSE) license.
Made by [@huntabyte](https://github.com/huntabyte) and [community](https://github.com/svecosystem/formsnap/graphs/contributors) 💛
<br><br>
<a href="https://github.com/svecosystem/formsnap/graphs/contributors">
<img src="https://contrib.rocks/image?repo=svecosystem/formsnap" />
</a>

<!-- /automd -->

## Releasing

This repository publishes [`@emmorts/formsnap`](https://www.npmjs.com/package/@emmorts/formsnap) from
GitHub Actions.

1. Add a `## <version>` section to
   [`packages/formsnap/CHANGELOG.md`](./packages/formsnap/CHANGELOG.md) describing the change.
2. Run `npm run release -- <version>`. It checks the tree, the changelog and the tag, then bumps
   `packages/formsnap/package.json`, commits, tags `v<version>` and pushes.
3. CI type-checks, tests, builds and publishes the package, then opens a GitHub release whose notes
   are that changelog section.
