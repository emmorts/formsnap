# Formsnap implementation plan

Initial assessment: `@emmorts/formsnap` 2.1.1 source on 2026-10-10.
Status: Phases 1–2 are complete, including P2.1 under the user-approved scope-owned SSR association
contract. Full regression, compatibility, and packaging verification passed in GitHub Actions.
Checked items do not approve a release or its classification. Historical evidence below refers
to the initial assessment; outcome and review notes describe the implementation that replaced it.

## Scope and tracking rules

Formsnap owns accessible presentation, field/control composition, and integration with
Superforms. Keep validation, submission, enhancement, reset, and taint management in Superforms.
Preserve unstyled components, native HTML defaults, Svelte snippets, and the existing headless
hooks. Do not add a second form-state store or a submission abstraction.

Check an item only after its acceptance criteria are exercised. Record the implementation PR,
verification commands/scenarios, results, and any migration notes under that item. A phase is
complete when every item in it is checked; explicitly record any agreed scope changes rather
than silently dropping criteria. Update API documentation and the changelog with each shipped
change, not only during the documentation phase.

Evidence labels used below:

- **Observed:** exercised during the preceding read-only assessment.
- **Source:** confirmed by the current implementation or configuration.
- **[INFERENCE]:** a behavioral risk requiring reproduction before a fix is selected.
- **Proposal:** a feature or design decision, not a defect already demonstrated.

The normal in-memory Vite server-side rendering (SSR) probe failed on the installed dependency
combination. An isolated Svelte-compiled, esbuild-tree-shaken probe exercised actual components
and demonstrated the snippet/SSR failures below. That isolation is not proof that a normal
consumer build works. Browser hydration, screen-reader behavior, tarball contents, external
publishing configuration, and performance have not been verified.

## Phase 1: Restore a supported runtime and verification baseline

Highest priority. Establish an ordinary consumer path before relying on isolated probes.

### P1.1 Supported dependency contract (original priority 1)

- [x] Align supported versions and prove normal consumer loading.

Source: [package peers/dependencies](../packages/formsnap/package.json#L41) promise Svelte
`^5.0.0` and Superforms `^2.19.0 || ^3.0.0`, while depending on toolbelt `^0.10.6`.
The [lockfile](../pnpm-lock.yaml#L2168) records toolbelt's Svelte peer as `^5.30.2`, but the
[workspace baseline](../pnpm-lock.yaml#L78) resolves Svelte 5.11.0 and Superforms 2.19.1.
Observed: a normal SSR load failed with `Missing "./attachments" specifier in "svelte" package`.

Implementation: select the minimum supported Svelte version based on the runtime dependencies;
recommend aligning with the retained toolbelt requirement rather than advertising unsupported
older versions. Align root/package development dependencies and lockfile. Check compatibility
of the retained compiler, plugin, and tooling instead of upgrading every dependency by default.
Treat an increased public minimum as a release-policy decision, not automatically a patch.

Acceptance: a clean consumer install has no incompatible runtime peer combination; ordinary
SSR loading and browser loading succeed without aliases, mocks, selective dependency exports,
or tree-shaking workarounds. Verify the documented minimum and current supported Svelte
baselines with Superforms 2 and 3, using compatible combinations rather than an invalid Cartesian
product. Record exact versions and the support policy.

Outcome (2026-10-10):

- Minimum raised to `svelte` `^5.30.2` in the peer range and in both workspace development
  ranges; the lockfile now resolves Svelte 5.57.2. Rationale: `svelte-toolbelt` 0.10.6 declares
  `svelte: ^5.30.2` and its published entry unconditionally re-exports `attach-ref`, which imports
  `svelte/attachments` (first shipped in Svelte 5.29). Compiling with Svelte 5.11.0 confirmed the
  installed version has no `./attachments` export, so `^5.0.0` was never satisfied.
- Reproduced before the change through the normal toolchain (Vitest with the repository's
  `sveltekit()` plugin, not the earlier tree-shaken probe): importing `$lib/index.js` failed with
  `Missing "./attachments" specifier in "svelte" package`. The same import passed after the bump.
  The throwaway probe was deleted; P1.2 owns the permanent consumer-loading regression test.
- Retained tooling re-checked rather than upgraded wholesale. `@sveltejs/kit` development range
  moved to `^2.21.0` (resolves 2.70.3) because `svelte-toolbelt` -> `runed` declares it as an
  optional peer; that removed pnpm's unmet-peer warning. Vite, `@sveltejs/vite-plugin-svelte`,
  TypeScript, SvelteKit and `svelte-check` majors were kept.
- Svelte 5.57 emits a new `custom_element_props_identifier` warning, which surfaced as five
  `svelte/valid-compile` errors because `eslint-plugin-svelte` 2.x compiles every component with
  `customElement: true`. Fixed by upgrading to `eslint-plugin-svelte` 3.23.1, which compiles that
  way only for components declaring `customElement`/`tag`; the superseded direct
  `svelte-eslint-parser` development dependency was removed, and the flat-config parser block now
  also covers `.svelte.js`/`.svelte.ts` rune modules (v3 applies the Svelte parser to them, which
  otherwise broke parsing of `formsnap.svelte.ts`). The upgrade also enabled
  `svelte/require-each-key`, which flagged the unkeyed error list in `field-errors.svelte`; the
  list is now keyed by index, matching the previous reconciliation.
- Verified at this commit: `pnpm lint`, `pnpm --filter @emmorts/formsnap run check` (0 errors),
  `pnpm test:package` (29 tests), `pnpm --filter @emmorts/formsnap run package` (publint clean).

Remaining for P1.1: the version matrix and browser loading were P1.2's work, which verified the
Svelte 5.30.2 floor and the Superforms 2/3 combinations in CI and by hand (see P1.2).

Release note to publish with the next version: "Raises the minimum supported Svelte version to
5.30.2, which `svelte-toolbelt` 0.10 already requires; earlier 5.x releases could not load the
package."

### P1.2 Consumer verification harness (original priority 4, first part)

- [x] Establish reusable SSR, browser, and consumer-type verification.

Source: [current tests](../packages/formsnap/src/lib/internal/utils/path.test.ts#L188) exercise
path/error utilities; [Vitest configuration](../packages/formsnap/vite.config.ts#L4) contains
only the source test glob. [CI](../.github/workflows/ci.yml#L16) already runs lint, type checking,
tests, and packaging on one frozen dependency baseline.

Implementation: retain useful utility tests and existing checks. Add a small Superforms-backed
consumer fixture, SSR execution, browser lifecycle execution, and public type cases. Reuse this
fixture for the complete example in P3.1. Introduce compatibility jobs for the combinations from
P1.1. Keep regression tests with their corresponding fixes in Phase 2, rather than building a
large disconnected test suite first.

Acceptance: the fixture loads through the normal dependency path; compatibility jobs validate
both runtime loading and public types. The browser runner can observe DOM attributes after
state updates and mount/unmount transitions. Tests remain deterministic and isolated. Assertions
cover consumer-visible behavior, not source text, forwarding mocks, or coverage percentages.

Outcome (2026-10-10):

- The harness lives inside the library package. It is already a minimal SvelteKit project
  (`src/app.html`, the `sveltekit()` plugin, a generated tsconfig that already includes
  `tests/**`), and both `src/routes/` and `tests/` sit outside `src/lib`, so svelte-package ships
  nothing new. Artifact-level verification deliberately stays with P6.2.
- `src/routes/` is now a runnable fixture app: `+page.server.ts` validates with `superValidate`,
  `settings-form.svelte` is the reusable form, and `+page.svelte` passes `data.form` to it. P3.1
  turns this into the documented walkthrough.
- `vitest.workspace.ts` defines two projects. `unit` runs the Node tests and
  `tests/**/*.ssr.test.ts`; its global setup boots the fixture app on a fixed port (5199) and the
  tests assert the server-rendered document through `linkedom`. Component-level SSR rendering was
  rejected: `superForm` reads `$app/stores`, which only works inside SvelteKit's request context.
  `browser` runs `tests/**/*.browser.test.ts` in Chromium through Playwright, mounting fixtures
  directly so lifecycle and effects are observed for real.
- Public type cases live in `tests/types.ts`, which no test glob matches: `svelte-check` checks it
  through the package tsconfig, so a broken exported type fails `pnpm check`.
- CI installs Chromium for the verify job and adds a two-entry compatibility matrix covering the
  advertised edges — `svelte@5.30.2` + `sveltekit-superforms@2.19.0` + `zod@3.25.76`, and `svelte@5`
    - `sveltekit-superforms@3.0.0` + `zod@4.6.5` — each running type-check, tests and packaging.
- Verified by hand for all three combinations (locked baseline: Svelte 5.57.2, Superforms 2.31.0,
  zod 4.6.5): `svelte-check` reports 0 errors and all 38 tests pass in both projects.
- Toolchain alignment this required: `vitest` and `@vitest/browser` on 2.1.9, `vite` unified on
  5.4.11 (the browser runner had pulled a second copy whose types collided in the Vitest config),
  and `typescript` resolving to 5.9.3 within the unchanged `^5.6.2` range.

Review outcome (2026-10-10):

- The harness now covers real-page hydration and native/enhanced action submissions as well as
  isolated component lifecycle behavior. Its fixture port is dynamically reserved rather than
  fixed; optimizer caches are separated between component tests and the fixture application.
- Compatibility is not an unrestricted cross-product: Superforms 3.0.0 requires Svelte 5.56.4
  even though Formsnap itself supports Svelte 5.30.2 with Superforms 2. CI now has both minimums
  plus current Svelte 5/Superforms 3. The release workflow installs Chromium before running tests.
- Locally exercised combinations: Svelte 5.30.2 / Superforms 2.19.0 / zod 3.25.76,
  Svelte 5.56.4 / Superforms 3.0.0 / zod 4.6.5, and Svelte 5.57.2 / Superforms 3.0.0 /
  zod 4.6.5. Each passes `pnpm --filter @emmorts/formsnap run check` (zero errors/warnings),
  `test` (74 tests across six files), and `run package` (publint clean). Temporary matrix
  manifest/lockfile changes are restored before the final development-baseline run.
- The locked development baseline, Svelte 5.57.2 / Superforms 2.31.0 / zod 4.6.5, also
  passes all 74 tests. The package README now documents a real native POST action,
  matching the exercised root fixture; later integration recipes remain P3.1 work.

Findings the harness produced:

- Observed, was [INFERENCE]: unmounting a `Description` leaves the mounted control's
  `aria-describedby` pointing at the removed node. `tests/lifecycle.browser.test.ts` encodes this
  with `it.fails` and names P2.2; the assertion flips to `it` when P2.2 lands.
- Observed: the server-rendered control carries no `aria-describedby` although its description
  element is rendered, because the association id is derived from DOM refs in effects. That is
  P2.1's target; the SSR test does not assert the buggy absence.
- Consumer constraint: `sveltekit-superforms` 2.31 and 3.0.0 type their zod adapter against
  `zod/v3`, and the zod copy must be the one superforms resolves — unrelated duplicates make the
  adapter types incompatible. The fixture imports `zod/v3` and pins zod 4.6.5; the 2.19.0 floor job
  installs zod 3.25.76, where the adapter reads the `zod` main entry. P3.1 must document this,
  because nothing in Formsnap reveals it.
- Consumer constraint: `superValidate` in the browser needs an adapter carrying a JSON schema, so
  `zodClient` cannot build a browser fixture; the tests use the `zod` adapter.
- Consumer constraint: Svelte 5.57 warns `state_referenced_locally` for the `superForm(data.form)`
  pattern the root README shows. The fixture reads the value through `untrack`, which is the pattern
  P3.1 should document.

### P1.3 Immediate onboarding correction (original priority 5, first part)

- [x] Correct conflicting package instructions and fork support routing.

Source: the [package README](../packages/formsnap/README.md#L8) installs/imports unscoped
`formsnap`, uses `Control let:attrs`, and gives array defaults to scalar enums. The
[root README](../README.md#L57) uses the scoped package and Svelte 5 snippets.
[Help routing](../.github/ISSUE_TEMPLATE/config.yml#L2) and the
[bug-report environment command](../.github/ISSUE_TEMPLATE/3-bug_report.yml#L41) still target
upstream/unscoped Formsnap.

Implementation: choose one canonical quickstart source and keep both READMEs consistent without
introducing a new documentation platform. Correct installation/imports, snippets, and schema
examples. Identify formsnap.dev as upstream documentation and explain fork-specific differences.
Route fork reports to a supported fork channel; preserve upstream attribution and license text.

Acceptance: both READMEs describe the actual scoped API, their schema examples type-check, and
support links/environment commands identify the fork. Version guidance matches P1.1. The full
submission walkthrough remains tracked in P3.1.

Outcome (2026-10-10):

- Canonical quickstart: `packages/formsnap/README.md`. It shows the fixture app's own code — schema,
  `load` function, form component, page — so the examples type-check through `pnpm check` rather
  than merely resembling working code. It states the requirements table matching the peer range
  (P1.1), the `zod/v3` constraint P1.2 uncovered, the upstream/fork split, and keeps the MIT
  attribution to upstream.
- The root README is now a landing page: goal, install, requirements, components, support, sponsors,
  license, releasing. Its duplicated walkthrough was removed, because a second copy of the
  quickstart is what drifted in the first place; the Fieldset/Legend/checkbox/radio showcase returns
  with P3.1's recipes, where it can be verified. "Check out formsnap.dev" and the upstream Discord
  link are replaced with an explicit upstream-versus-fork split.
- Issue templates: `config.yml` help routing now states that upstream discussions answer usage
  questions while fork-specific problems belong here; the bug report's `envinfo` command lists
  `@emmorts/formsnap` instead of the unscoped name, and its stale Discord link is gone.
- Verified: `pnpm lint` and `svelte-check` (0 errors) pass; no unscoped package or `let:attrs`
  references remain in the READMEs or templates.

Resolved (2026-10-10): Issues were enabled on `emmorts/formsnap` using the authenticated GitHub
CLI. The fork-specific report route is live. Discussions remain upstream; the fork does not
advertise a separate discussions channel.

Phase gate: normal loading and the verification harness work; no core accessibility fix is
considered complete merely because compilation succeeds. P1.3 can proceed while P1.1 is resolved.

## Phase 2: Correct field values, identity, and accessibility lifecycle

Depends on P1.1 and P1.2. These fixes precede new presentation components.

### P2.1 Initial identity and SSR associations (original priority 2, first part)

- [x] Make IDs and accessibility associations correct before client effects.

Source: [ID generation](../packages/formsnap/src/lib/internal/utils/id.ts#L1) uses a
module-global counter. [ControlState](../packages/formsnap/src/lib/formsnap.svelte.ts#L297)
creates another ID and synchronizes the supplied ID through `useOnChange`.
[Field association IDs](../packages/formsnap/src/lib/formsnap.svelte.ts#L87) start undefined
and are populated from DOM nodes by effects. Observed: `Control id="email-input"` rendered a
generated ID; the input lacked `aria-describedby` despite rendered description and error nodes.
[INFERENCE]: counter history can cause server/client identity mismatch across renders.

Implementation: use a Svelte-supported hydration-stable identity mechanism compatible with the
selected minimum version. Honor explicit IDs synchronously. Define an SSR-capable association
contract that does not depend on DOM discovery. Account for sibling render order: registering a
Description after an earlier input has rendered is not, by itself, sufficient. Specify handling
of optional/custom snippets before choosing registration internals.

Acceptance: SSR HTML honors explicit IDs, has matching label/control associations, and references
rendered descriptions and existing server-side errors when Control appears before or after their
components. No fabricated or absent targets are referenced. Multiple forms and repeated server
renders hydrate without ID mismatches or duplicate IDs. Verify the form with JavaScript disabled.

Outcome (2026-10-10):

- Identity: `useId` is now a pure formatter over `$props.id()`, which Svelte guarantees is the same
  in the server-rendered HTML and during hydration. Each component reads its own instance id at the
  top level, because the rune is only allowed as a variable declaration initializer in a component —
  calling it from a function in `formsnap.svelte.ts` fails with `props_id_invalid_placement`. The
  module-global counter it replaces made an id depend on how many components the process had created
  before it, so repeated renders of one page produced different ids for the same element.
- Explicit ids: `ControlState` takes the consumer's id at construction instead of through
  `useOnChange`, which only runs in an effect and never on the server. `Control`'s fallback label id
  now derives from the same instance id through `useId(instanceId, "label")`.
- Evidence: a fixture with `Control id="email-input"` renders that id and a label whose `for`
  matches it; two consecutive renders of the fixture serve identical id sets, which the counter could
  not do. Verified on both the Svelte 5.30.2 floor with Superforms 2.19.0 and the locked 5.57.2
  baseline with 2.31.0: `svelte-check` reports 0 errors and 40 tests pass in both projects.
- Revised acceptance, with the reason: the description and error associations cannot appear in a
  single server pass. The control's own id exists before its siblings render, but whether a
  `Description` or `FieldErrors` exists is only known once those components render — after the
  control has already been written into the response, because Svelte's server renderer emits in
  order. Reading presence from data would only work for errors, and would then reference a container
  that a consumer rendering errors through the `Field` snippet never creates: a fabricated target,
  which this item forbids. Association therefore stays registration-based — applied as soon as the
  container renders, which on the client is before the user can interact, and asserted by the
  browser project — and server-rendered HTML intentionally carries no `aria-describedby`. Getting
  the association without JavaScript needs an explicit API, such as handing the container's id to
  `Control`, which is a decision to take up rather than guess.
- The fixture dependency `zod` is pinned to the exact version `sveltekit-superforms` resolves
  (4.6.5) rather than a caret range, because unequal copies make the adapter's types incompatible
  (P1.2). Update the pin together with `sveltekit-superforms`.

Review correction (2026-10-10): identity and explicit control IDs were implemented, but the
original automatic SSR description/error association criterion was not met. The earlier
"revised acceptance" was an implementation tradeoff, not an agreed scope reduction, so this item
remains unchecked for that criterion. Client registration cannot backpatch a control already
rendered by Svelte's server renderer. Consumers can already provide stable `Description` and
`FieldErrors` IDs and set native `aria-describedby` explicitly; automatic, optional-container
discovery before rendering still needs a design decision. Do not invent container presence from
validation data or duplicate-render consumer snippets.

Approved contract and implementation (2026-10-10):

- The user approved scope-owned content slots rather than arbitrary optional-container discovery.
  This explicitly replaces the original unbounded SSR association criterion: `Field`, `ElementField`,
  and native `Fieldset` declare and render their own description/error containers. Freely composed
  standalone regions and caller-owned headless containers retain their existing lifecycle and
  require explicit native `aria-describedby` for server associations.
- `description?: Snippet` and `fieldErrors?: boolean | Snippet` declare content only. Omitted
  descriptions and omitted/false errors create neither a container nor an association. Optional
  `descriptionId`/`fieldErrorsId` override enabled targets; IDs alone do not reserve containers.
  Defaults derive from each owning scope's unconditional `$props.id()`, not paths or row indices.
- Controls read those declarations synchronously before rendering children. Managed regions render
  after children without a root wrapper, duplicate snippet execution, or mounted registration.
  Enabled empty error wrappers stay present, but their IDs are referenced only while errors exist.
  Additional mounted contributions still merge and deduplicate through the existing owner registry.
- `ElementField` prefers local instructions and otherwise inherits its parent's declared description.
  Native `Fieldset` keeps owned regions inside the fieldset. Full-container `child` replacement
  remains available without owned content; enabled owned content plus `child` is rejected in public
  types and through a reactive runtime guard.
- Migrated settings, primitive arrays, and enhanced JSON examples. Added `/owned` with conditional
  slots, ID changes, custom errors, parent/local inheritance, multiple forms, disabled regions,
  caller-owned native references, native containment, and snippet-execution counters.
- Observed before the workstation interruption: `svelte-check` reported 0 errors and 0 warnings;
  all six owned-content browser regressions passed. Real-page `/owned`, `/owned?local=true`, and
  `/json` SSR/hydration checks passed, as did native rejected/corrected submissions. Manual Chromium
  smoke confirmed initial no-JavaScript description references, rejected POST error references,
  correction withdrawing error references, reactive ID changes, and local/parent inheritance.
- The initial integrated suite had 86 passes and six failures: two real-page hydration timeouts
  and four isolated SSR harness failures. Runtime conflict coverage now uses real SvelteKit
  requests instead of rendering Superforms outside request context. Invocation instrumentation uses
  a nonreactive record rather than a mutable `Map`. Final verification ran in GitHub Actions, not
  on the production workstation.
- Implemented in `e9d0bc5` (`feat: add scope-owned SSR description and error slots`).
  [Draft PR #1](https://github.com/emmorts/formsnap/pull/1) and
  [CI run 38047818196](https://github.com/emmorts/formsnap/actions/runs/38047818196) exercise the
  integrated implementation: lint passes; each of the four jobs reports 0 type errors/warnings,
  all 92 tests across seven files passing, and successful package generation/publint.
  The jobs cover the locked Svelte 5.57.2/Superforms 2.31.0 baseline, Svelte 5.30.2/Superforms 2.19.0,
  Svelte 5.56.4/Superforms 3.0.0, and current Svelte 5/Superforms 3. Both original hydration timeouts
  and all real-request conflict cases pass without raising timeouts. P2.1 is complete under the
  approved ownership contract; Phases 3–6 remain.
- Manual screen-reader announcements remain unverified. No validation/submission abstraction,
  dependency-range change, arbitrary SSR discovery, or release classification is part of this API.

### P2.2 Association ownership and inherited instructions (original priority 2, second part)

- [x] Define and implement association registration, cleanup, and inheritance.

Source: [field state](../packages/formsnap/src/lib/formsnap.svelte.ts#L87) stores one description
and one error slot. Updates only write IDs when nodes are present; the
[headless overrides](../packages/formsnap/src/lib/formsnap.svelte.ts#L454) accept nullable getters
but only write truthy results. [ElementField](../packages/formsnap/src/lib/formsnap.svelte.ts#L159)
derives a parent-description fallback, but its ID update observes only the local description.
Observed (browser harness, P1.2): unmounting a `Description` leaves the control's
`aria-describedby` pointing at the removed node. [INFERENCE]: descriptions compete for the single
slot; the intended inherited instructions do not reach the rendered control.

Implementation: reproduce these transitions in the normal fixture. Propose ordered, deduplicated,
owner-specific registration for multiple descriptions, with cleanup that does not erase another
owner's registration. Decide whether multiple error containers are supported or explicitly
restricted. Define external `aria-describedby` composition and override precedence. Preserve the
existing intended local-description-or-parent fallback unless a different rule is agreed. A
headless override returning null must relinquish ownership under the documented fallback rule.

Acceptance: add/remove descriptions in both orders; remove an error container while errors
remain; change custom IDs; release nullable overrides; and add/remove element-local instructions.
Every Formsnap-owned description/error reference names a current target, with no duplicate
tokens. Parent instructions are restored when a local description disappears. Error targets are
included only while relevant errors exist. Exercise supported multiplicity and form isolation.

Outcome (2026-10-10):

- The single node slots are gone. Each field now holds an `AssociationIds` registry: a contributor
  registers the id it actually rendered and withdraws that id when the element goes away, so one
  description unmounting cannot erase another's association and no reference outlives its target.
  `getAriaDescribedBy` takes the two id lists and still appends error containers only while the
  field has errors.
- `errorNode`, `descriptionNode` and `derivedDescriptionNode` were deleted. The last one was only
  ever written, never read, which is why an `ElementField` never actually inherited anything: the
  element's state now falls back to the parent field's description ids at read time, so an element
  with its own description uses that one and an element without one inherits the field's.
- Headless overrides are contributions with owners: `useFormField` withdraws the id it previously
  contributed before adding the new one, so a getter returning null releases it. `useFormControl`
  now clears an override instead of writing an id, and `ControlState.id` is a getter that falls back
  to the component's own id, so a null override no longer pins a stale id.
- Evidence, all in `tests/associations.browser.test.ts` (9 tests, Chromium): every rendered
  description is referenced in render order; only the unmounted one is withdrawn; one field's
  descriptions never appear on another field; an error container that unmounts stops being
  referenced while `aria-invalid` stays true; six alternating toggles never leave a dangling
  reference or a duplicate id; an `ElementField` uses its own description while it exists and gets
  the field's description back when it disappears; a null override is released. The regression test
  that previously pinned the unmount defect now passes as an ordinary test, because the fix landed
  with it.
- Ordering is registration order, which equals document order for a static tree. A description that
  remounts re-registers at the end rather than being re-sorted by DOM position; the plan's
  "ordered" requirement is met without reading the DOM during state access.
  Review outcome (2026-10-10):

- Registry entries are now keyed by contributor, not by the contributed ID. Two owners may share
  an ID; releasing either one preserves the other's entry, and final reference tokens are
  deduplicated. This also applies when description and error contributors share one target.
- `useFormField` and `useFormControl` release their contributions on component destruction.
  Multiple control-ID overrides restore the last remaining owner, then the component's own ID.
  Reactive IDs, null releases, destruction order, and inherited descriptions have consumer cases.
- `Description` and `FieldErrors` use attachments on the actual rendered element instead of
  finding nodes by ID. A custom child that spreads its props registers its actual ID; an omitted
  or unmounted container cannot accidentally associate an unrelated element elsewhere in the
  document. `ref` forwarding continues to report the mounted node and clears on withdrawal.
- Ordering remains registration order, not general document order after remounts. Automatic
  association registration still requires client mounting; this fixes lifecycle ownership, not
  P2.1's unresolved automatic SSR association criterion.

### P2.3 Nested values, constraints, and public inference (original priority 3)

- [x] Make Field, Fieldset, and ElementField path behavior consistent.

Source: both [Field snippets](../packages/formsnap/src/lib/formsnap.svelte.ts#L113) and
[ElementField snippets](../packages/formsnap/src/lib/formsnap.svelte.ts#L203) index form data
by the complete path string. ElementField also directly indexes snippet constraints, although
its separate derived constraint/value properties use path lookup. Observed: `profile.name` and
`urls[0]` snippet values rendered as `undefined`. [Public snippet types](../packages/formsnap/src/lib/components/types.ts#L54)
use `T[U]`; [PrimitiveFromIndex](../packages/formsnap/src/lib/internal/types.ts#L3) handles only a
limited top-level array shape. [splitArrayPath](../packages/formsnap/src/lib/formsnap.svelte.ts#L445)
strips everything after the first bracket for the submitted control name.

Implementation: use one consistent path-aware value contract across components and snippets.
Prefer shared Superforms path/value types available in both supported major versions. Retain the
deliberate Superforms compatibility boundary; do not blindly replace `FsSuperForm` with a
stricter full `SuperForm` type. Check actual Superforms constraint shapes for array elements before
assuming constraints mirror the data tree. Define ElementField's native repeated-name versus
JSON nested-path submission semantics, preserving valid existing array submissions.

Acceptance: runtime and consumer-type cases agree for top-level values, nested objects, primitive
arrays, arrays of objects, nested arrays, optional/missing values, and changing field names.
Fieldset snippets have the same path-value inference. Updates to data/errors/taint/constraints
reach the rendered consumer; insert/remove/reorder scenarios keep fields attached to their
intended rows. Verify native repeated-name and `dataType: 'json'` submissions with real
Superforms behavior. Invalid paths are rejected by the public types where promised.

Outcome (2026-10-10):

- `Field` and `ElementField` both resolve their snippet value through `getValueAtPath`, which is why
  `profile.name` and `urls[0]` used to arrive as `undefined`: they indexed the raw path string as a
  single key. `ElementField`'s snippet constraints now use its path-aware getter instead of a second
  direct lookup, and the two snippet objects are identical in shape.
- The public snippet `value` types are `FormPathType<T, U>` from Superforms (present in 2.19, 2.31
  and 3.0.0) instead of `T[U]`, so a path resolves to the value at that path rather than to an
  index-signature or `never`. `PrimitiveFromIndex` is deleted, and the Fieldset no longer needs the
  `value as T[U]` casts it carried.
- Evidence, `tests/paths.browser.test.ts` (6 tests, Chromium): a nested object property, a primitive
  array element, an array-of-objects element, a nested array element, a missing optional field and a
  whole object all arrive with the right value; later data changes reach the consumer and flip
  `tainted` to true; constraints arrive (`minlength` on a nested string); a path error arrives for an
  array element and for a nested property; and a field follows its path when the `name` prop changes.
  The associations suite adds the native submission contract — both array elements render
  `name="urls"` with distinct ids — and `tests/types.ts` pins the value inference for string,
  number, object and optional paths through the public props, including `Fieldset`.
- Review correction: Superforms' constraint tree is schema-shaped, not index-shaped. An actual
  `superValidate` probe returned `items.id.min`, not `items[0].id.min`; the old lookup dropped all
  indexed constraints. Both field variants must remove bracket indices for constraint lookup
  while preserving numeric object keys. Error and taint paths still retain their indices.
- Review fix: public snippets use `FormPathValue<T, U>`, a Superforms path-value type augmented
  with `undefined` when an optional or nullable ancestor prevents traversal. Runtime lookup
  prioritizes an exact own top-level key before interpreting delimiters, preserving existing
  fields such as `"contact.email"`. Constraint lookup also preserves an exact top-level schema
  key before removing bracketed array indices; a literal `"contact[0]"` and a numeric object key
  such as `codes.123` remain intact. The literal-bracket browser regression returned `{}` before
  this correction and the actual `{ minlength: 3, required: true }` constraint afterward in both
  field variants. Consumer runtime and type cases cover these distinctions and nested arrays.
- Scope move, recorded rather than dropped: "insert/remove/reorder scenarios keep fields attached to
  their intended rows" and the POST round trip for native repeated-name and `dataType: 'json'`
  submissions need array-mutating fixtures and a server action, which P2.4 builds for its remaining
  regression coverage.

### P2.4 Regression and compatibility enforcement (original priority 4, second part)

- [x] Keep failing-before/passing-after coverage for the corrected public contracts.

Implementation: add the P2.1–P2.3 scenarios to the P1.2 harness as each fix lands. Cover native
checkbox/radio labeling and native fieldset/legend grouping alongside the failures, so new
registration logic does not regress working defaults. Run consumer-type cases against both
supported Superforms majors. Add automated accessibility checks where useful, without treating
an automated scan as screen-reader verification.

Acceptance: failures are reproduced before fixes; targeted regression cases pass afterward;
normal SSR-to-hydration and invalid-submit scenarios work in the fixture. A deliberate broken
association or wrong nested value fails the corresponding behavioral assertion. Record browser
results and remaining manual assistive-technology limits.

Outcome (2026-10-10):

- Native controls, `tests/regressions.browser.test.ts`: a checkbox is associated with the label that
  follows it and its checked state comes from the submitted value; a radio group renders inside the
  `fieldset` its `legend` names, one control per option, each with its own label and id, with the
  selected option taken from the data.
- The original array-row test only rendered outputs keyed by index. Its empty ID/reference
  checks were vacuous; it established value-by-index updates, not keyed control identity.
- Submissions, `tests/server-rendering.ssr.test.ts`: the fixture app has a POST action now, and a
  urlencoded submission that fails validation answers 400 with `aria-invalid="true"` and the rendered
  error text, while a valid one answers 200. One detail worth keeping: a `fetch` POST without
  `accept: text/html` receives Kit's serialized action result instead of the re-rendered page, so the
  no-JavaScript path has to ask for the document.
- The original parser-only array submission check and direct helper self-tests were insufficient
  integration evidence. Real browser form submissions and rendered consumer assertions replace
  these during the review.
- Consumer type cases run against both supported Superforms majors through the P1.2 CI matrix, which
  type-checks `tests/types.ts` on 2.19.0 and 3.0.0.

Review correction: the original JSON submission and hydration gaps were harness choices, not
technical impossibilities. Superforms enhancement posts its serialized form store in
`__superform_json` FormData; a browser can submit it to the same normal SvelteKit action.
Hydration must be checked by loading a real server-rendered SvelteKit page, not by passing a
client-compiled component to `svelte/server`. The review adds those real-page scenarios; do not
use repeated server-render ID equality as a substitute for server-to-client parity.

- Screen-reader behaviour. The browser project asserts DOM and attribute behaviour; announcement
  mechanics and focus order still need manual testing with a real assistive technology, and no
  automated scan is treated as a substitute for that.

Review outcome (2026-10-10):

- `tests/consumer.ssr.test.ts` exercises real SvelteKit pages in Chromium. Freezing the initial
  browser module request preserves a queryable SSR document; releasing it proves that hydration
  reuses the same DOM nodes and IDs. Separate no-JavaScript contexts submit invalid and valid
  repeated-name array data through the fixture action and inspect returned data and errors.
- The `/json` fixture binds nested data with `dataType: "json"` and `use:enhance`. Consumer cases
  verify the actual `__superform_json` payload, non-navigation action requests, indexed invalid
  results, corrected submissions, and cleared invalid state after adding, reordering, and removing
  rows. The manual browser smoke also reproduced and fixed row replacement losing keyboard focus:
  row keys are now local stable IDs, not Superforms data-object identities. Sequential typing
  retains the control's ID and complete edited value.
- The first integrated run exposed a harness runtime collision: the component browser project and
  the fixture application shared Vite's dependency optimizer cache, yielding `effect_orphan`.
  `vitest.browser.config.ts` now uses `.vite-browser-tests`; `tests/dev-server.ts` uses
  `.vite-consumer`. Real-page hydration and enhanced submission pass with isolated caches.
- The fixture server reserves an available port, checks HTML warmup responses for all three
  routes, closes on setup failure, and returns teardown cleanup. Component fixtures await
  unmount before clearing the document. Public type cases include invalid-path rejection.
- The isolated full suite passes all 74 tests across six files. Earlier direct helper self-tests
  were removed in favor of consumer-visible association, value, and submission assertions.
  Browser console warnings/errors and uncaught exceptions fail the real-page cases; only the
  expected network diagnostic for deliberately rejected HTTP 400 submissions is allowed.
- At this review, automatic SSR `aria-describedby` remained outside the exercised contract and
  kept P2.1 unchecked. The subsequent user-approved scope-owned contract and its verification are
  recorded under P2.1. Manual screen-reader announcement and focus-order checks remain unverified;
  release classification remains a maintainer decision.

Phase gate: the existing component contract works in ordinary consumers, including initial HTML
and reactive transitions. Release-policy decisions are recorded for changed names/types/peers.

## Phase 3: Publish a complete integration path

Depends on Phases 1–2. This documentation work can run alongside Phase 4.

### P3.1 Runnable quickstart and integration recipes (original priority 5, remaining work)

- [ ] Complete the submission walkthrough and the missing composition recipes.

Source: the [root server example](../README.md#L39) provides `load` without a POST action, while
the page submits with `method="POST" use:enhance`. Existing components/hooks support more than
the root walkthrough demonstrates.

Implementation: extend the shared fixture into a complete SvelteKit example with a schema,
load, server action, invalid response, and successful response. State compatible schema-library
and adapter versions. Show progressive enhancement without wrapping Superforms submission APIs.
Add focused recipes for nested JSON data, dynamic arrays with stable row identity, custom `child`
snippets/ref forwarding, native constraints, file inputs, multiple forms, and pending/success
feedback sourced from Superforms. Document keyboard/accessibility responsibilities of custom
controls. Add feature-specific examples when Phases 4–5 land.

Acceptance: a user following the documented setup can submit invalid and valid data with and
without JavaScript; field errors and success feedback are visible. Recipes execute against the
supported public API rather than relying on snippets that only compile. Document schema/adapter
version differences instead of assuming one example works unchanged for every supported major.

Phase gate: the published quickstart is complete, and recipes state where Formsnap's ownership
ends. A standalone docs deployment or form builder is not required.

## Phase 4: Complete announcement and custom-control composition

Depends on Phase 2 and its browser harness. Finish this contract before designing ErrorSummary.

### P4.1 Configurable announcements (original priority 6)

- [ ] Allow an explicit FieldErrors live-region policy and document precedence.

Source: [generated error props](../packages/formsnap/src/lib/formsnap.svelte.ts#L243) hardcode
`aria-live="assertive"`; [FieldErrors](../packages/formsnap/src/lib/components/field-errors.svelte#L23)
merges generated props after caller props. The existing default keeps the container mounted when
there are no messages, which is useful for later live-region updates.

Implementation: support caller-selected `polite`, `assertive`, and `off` without losing generated
IDs or error associations. Keep the current default initially unless manual evaluation and a
release decision justify changing it. Define prop precedence explicitly. Do not add speculative
announcement attributes or change when Superforms validates.

Acceptance: each caller policy reaches the rendered native and custom-child container; error
association/invalid state remains correct. Exercise input/blur validation, repeated errors,
submit-time multiple errors, and conditional containers. Record NVDA/Firefox and
VoiceOver/Safari observations, or leave manual acceptance incomplete if those environments are
unavailable. Guidance prevents competing field/summary announcements.

### P4.2 Custom-control and group semantics (original priority 8)

- [ ] Verify existing headless composition and fix native/custom parity gaps.

Source: [useFormControl](../packages/formsnap/src/lib/formsnap.svelte.ts#L529) already returns
`labelProps`, including an ID, plus control props. Native labels use `for`; arbitrary role-based
widgets need their own naming semantics. [Fieldset](../packages/formsnap/src/lib/components/fieldset.svelte#L60)
adds `data-fs-error` only in its native branch, not in generated custom-child props.

Implementation: start with recipes using the existing label-ID route rather than adding a second
headless API. Fix custom/default error-styling parity. Define which attributes and native
behaviors custom group replacements must supply. Add label/group helpers only if the recipes
show a missing reusable contract; do not set `aria-labelledby` on every native input or duplicate
widget libraries' keyboard behavior. One Control targets one control, not several widgets sharing
one generated ID.

Acceptance: native controls retain label association and fieldset/legend naming/disabled behavior.
Custom role-based controls and groups have usable accessible names and error/description
associations through forwarded props/ref. Native and custom Fieldset rendering expose equivalent
error-state styling. Verify keyboard interaction in the runnable integration, not only prop shapes.

Phase gate: announcement policy and custom target semantics are documented and exercised. Any
new helper API has an agreed public contract and consumer tests.

## Phase 5: Add opt-in form-wide error navigation

Depends on P2.1–P2.4, P3.1, and Phase 4. This is the first new presentation primitive.

### P5.1 ErrorSummary (original priority 7)

- [ ] Agree and implement an opt-in headless summary contract.

Proposal: [current component exports](../packages/formsnap/src/lib/components/index.ts#L1)
contain field-local errors but no ErrorSummary. The existing headless field hook does not provide
a form-wide label/control target registry. A summary is an addition, not proof that every current
consumer lacks accessible error handling.

Implementation: define items sourced from existing Superforms errors, useful labels, stable
control/group targets, and caller-controlled visibility/focus. Prefer an explicit resolver if it
avoids a mandatory new form wrapper or duplicated state. Decide how array/object-level `_errors`,
multiple messages for one field, grouped controls, and unopened sections map to summary items.
Do not guess a focus target for an unmounted field or duplicate Superforms' automatic focus logic.
Coordinate announcements with P4.1; keep rendering and navigation customizable through snippets.

Acceptance: multiple forms remain isolated; nested/array and form/group errors have useful labels
and deliberate targets. Keyboard users can follow links to the correct native or custom control;
callers can reveal collapsed sections before targeting them. Unmounted fields have a documented
non-broken navigation policy. Focus and announcements do not compete with enhancement options.
Changing errors updates the summary without a second error store. Include a runnable recipe.

Phase gate: the summary solves navigation in the supported cases end to end. Public API shape,
item ordering, aggregation, and missing-target behavior are agreed before exporting it.

## Phase 6: Reduce maintenance and release risk

Internal optimization depends on Phase 2 regression coverage. Release preflight can proceed
independently and should be completed before the next publish; it need not wait for ErrorSummary.

### P6.1 Reactive internals and context misuse (original priority 9)

- [ ] Measure field-update cost and simplify only where behavior is preserved.

Source: [FormFieldState](../packages/formsnap/src/lib/formsnap.svelte.ts#L72) clones entire
errors/constraints/taint trees per derived field lookup; ElementField uses a different approach.
[Context consumers](../packages/formsnap/src/lib/formsnap.svelte.ts#L411) use unguarded Svelte
context reads, while a separate [context helper](../packages/formsnap/src/lib/internal/create-context.ts#L7)
exists. There are no measured timings establishing the clone cost or proving removal safe.

Implementation: measure mount and field-update cost for representative small and large forms.
Remove avoidable whole-form copies only after identifying the reactive dependency requirements
and confirming consumers cannot mutate shared state through the changed API. Consolidate shared
field logic only where contracts match. Use one small guarded-context convention with errors
that identify the required parent; reuse or remove the existing helper rather than introducing
another framework. Remove disconnected internals/comments made obsolete by earlier fixes.
Do not remove already-public deprecated aliases as incidental cleanup; require an explicit
breaking-release decision and a clean caller migration if removal is selected.

Acceptance: equivalent before/after scenarios show measured results, no new allocations of whole
form trees on ordinary field lookup, no stale updates, and no mutation of Superforms stores.
Missing-parent misuse reports the required context. SSR, lifecycle, nested-path, and consumer-type
regressions still pass. If measurement rejects an optimization, record that outcome instead of
claiming a speedup.

### P6.2 Validate the distributable (original priorities 4 and 10)

- [ ] Smoke a packed package as a consumer artifact.

Source: [packaging](../packages/formsnap/package.json#L10) already runs `svelte-package` and
`publint`; the [files whitelist](../packages/formsnap/package.json#L36) includes dist and excludes
tests. CI builds but does not install a tarball consumer. The release workflow says the changelog
ships in the tarball, although it is not listed explicitly. [INFERENCE]: the changelog-shipping
claim needs verification against the packed contents.

Implementation: preserve publint and add a tarball-installed Svelte consumer check, including
representative public type cases and SSR/browser loading. Inspect shipped README/license,
declarations, exports, and test exclusions. Decide whether CHANGELOG.md should ship; include it
explicitly if intended, otherwise correct the claim. Do not add CommonJS or Node-only exports
without a consumer requirement.

Acceptance: the packed artifact runs through the normal supported consumer path, declarations
resolve, documentation identifies the scoped package, tests are excluded, and the recorded
changelog policy matches the observed tarball. Packaging checks run before publication.

### P6.3 Release preflight and recovery (original priority 10)

- [ ] Validate irreversible release prerequisites before publishing and document recovery.

Source: [release helper](../scripts/release.mjs#L47) already checks tree/changelog/main/tag state,
then pushes branch and tag separately. [Release CI](../.github/workflows/release.yml#L45) checks
tag/version and reruns checks/build, but parses changelog notes only after npm publish. Manual tags
bypass helper guards. OIDC trusted publishing is already configured in the workflow; external
registry/protection settings were not inspected.

Implementation: validate notes and the intended release lineage before publishing, including
manual-tag releases. Require the verification policy without relying on an unverified assumption
that branch CI passed. Document recovery after npm publication but before GitHub release creation,
including an already-existing release. Consider an atomic branch/tag push if the host supports it.
Retain version/tag equality and trusted publishing. Test release-note boundaries and missing/empty
sections with isolated fixtures; never use a production publish as a preflight test.

Acceptance: missing/empty notes and invalid release lineage stop before publish; the intended
version is validated and packaged. Dry-run or isolated release scenarios exercise parser failures
and recovery decisions without publishing. An already-published version cannot be mistaken for a
fresh success or silently overwrite a release. Document any external settings requiring operator
verification.

### P6.4 Contributor toolchain and commands (original priority 10)

- [ ] Align contributor guidance and remove misleading commands.

Source: [root toolchain](../package.json#L42), [package toolchain](../packages/formsnap/package.json#L65),
[Node pin](../.nvmrc#L1), and [CI Node version](../.github/workflows/ci.yml#L25) differ. Package
`dev` starts package watching, not a demo server; `test:ui` exists without a directly declared
Vitest UI dependency.

Implementation: document and align the tested contributor setup; define Node support explicitly
rather than narrowing it just to match CI. Distinguish package watch, the new example server, tests,
type checking, and packaging. Supply the UI dependency only if retaining that command.

Acceptance: a contributor following the documented setup can run each advertised command in its
stated role. Toolchain pins and engine promises match tested support. No broad dependency refresh
or unused development dependency is introduced.

## Decisions to record before implementation

These are unresolved product/release choices, not approved API names:

- Node minimum and contributor toolchain (P6.4). The Svelte minimum is resolved to `^5.30.2`, the
  version `svelte-toolbelt` 0.10.6 requires (P1.1). Still open: the release classification for
  narrowing the peer range. Recommendation: a patch on the 2.1.x line carrying the release note
  recorded in P1.1, because no Svelte version below the new floor could load the package.
- SSR association behavior for optional/custom snippets; multiple error containers; external ID
  tokens; nullable overrides; and local-versus-parent instructions (P2.1/P2.2).
- ElementField submitted-name semantics for native arrays and nested JSON paths (P2.3).
- Whether manual evidence justifies changing the default announcement policy (P4.1).
- Whether existing hooks are sufficient for custom naming/groups (P4.2).
- Summary item shape, target resolver/registration, aggregation, ordering, and focus ownership
  (P5.1).
- Any public alias removal and the migration/release policy (P6.1).

## Verification and completion policy

Existing commands, to run during implementation in the appropriate development or CI environment:

```sh
pnpm lint
pnpm --filter @emmorts/formsnap run check
pnpm test:package
pnpm --filter @emmorts/formsnap run package
```

These commands are not evidence that the roadmap is complete. Each item also requires its stated
consumer scenario; browser and assistive-technology checks need recorded observations. The root
`pnpm check` builds packages first, and current `pnpm dev` does not serve a runnable form demo.
New harness commands must be documented when introduced.

Keep this plan limited to the ten reviewed priorities. Defer a styled input catalogue, generic
form builder, wizard framework, duplicate validator, mandatory form wrapper, and standalone docs
platform unless a separately agreed requirement demonstrates the need.
