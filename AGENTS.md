# AGENTS.md

Behavioral guidelines for LLM coding assistants working on the
**sveltekit-i18n extensions** monorepo. Applies to anything that drives
commits, PRs, or file edits on this repo.

**Precedence:** These repo rules override individual LLM memory or personal
preference. If your own memory conflicts with this file, follow this file.

This repo follows the same working rules as
[`base`'s AGENTS.md](https://github.com/sveltekit-i18n/base/blob/master/AGENTS.md)
(sections 1-14: think before coding, simplicity first, surgical changes,
verify and review cycle with release planning, commit on approval, fixup
hygiene, branch & push discipline, PRs, docs track code, coding conventions,
security posture, English-only artifacts, test rules, terse output, no
emojis). What follows is only what differs here.

Those rules are not in this file, and nothing loads them for you: before any
change, read base's AGENTS.md in full — `../base/AGENTS.md` when `base` is
checked out beside this repository on an up-to-date `master`, otherwise
[the raw file](https://raw.githubusercontent.com/sveltekit-i18n/base/master/AGENTS.md)
— and follow it as fully as the rules below.

---

## The repository

Official extensions for the `config.extensions` pipe of
[`@sveltekit-i18n/base`](https://github.com/sveltekit-i18n/base) v3+. Part of
the [sveltekit-i18n](https://github.com/sveltekit-i18n/lib) ecosystem
(`base` / `lib` / `parsers` / `extensions`).

- **Monorepo without workspaces** — like `parsers`: no root `package.json`;
  each `extension-*/` directory is a fully standalone npm package with its own
  `package.json`, lockfile, configs, tests, README, and LICENSE. There is no
  CHANGELOG file: release notes are the GitHub Releases `publish.yml` creates
  per package tag (`extension-stores@<version>`).
- The root holds only `README.md` (extension pipe overview + package index),
  this file, `CLAUDE.md`, `.gitignore`, `.github/workflows/` and `bench/`.
- **`bench/` is the shared benchmark** (base's §4, step 3), run from a
  package directory as `npm run bench`, or `npm run bench -- --compare <dir>`
  against the same package checked out and installed at `<dir>`. `run.mjs`
  and `measure.mjs` are plain JavaScript that import nothing but Node's own
  modules, so Node runs them as they are and nothing type-checks or lints
  them — match the conventions by hand; `bench.d.ts` types what a package's
  modules receive. `run.mjs` builds each tree with its own toolchain and
  starts `measure.mjs` once per project and sample: counts and sizes once per
  side, times and heap in alternating processes. A package measures through
  `bench/counts.ts`, `times.ts` and `heap.ts`, each a default export of the
  `Measure` type, bundled per tree with the rolldown of vite's install and the
  `svelte` compiler — for the browser, or for the server when it is named
  `<project>.server.ts`. The package's own name resolves to the tree's
  `dist/`, its dependencies to the tree's install, and the core, `svelte` and
  the tools to the install of the package it runs from, so both sides run
  beside one copy of each and a difference between them is the tree's. Each
  package's size rows are a minified browser bundle of everything it exports,
  its dependencies included and its peers left out. `extension-typed-access`
  counts the checker's instantiations of a call through the tree, by key
  shape (flat keys, namespaces of 10 keys, one namespace) and size, on keys
  the extension groups and on the levels typegen registers, and times the
  proxy per segment; `extension-stores` counts the emissions a subscriber
  gets per update and times subscribing and an update reaching subscribers;
  `extension-html` times a server render per kind of message. Each package's
  heap rows run under `--expose-gc --max-opt=0` and are bounded — per call,
  per subscription, per render and per instance wrapped and dropped, after
  enough of them that a `WeakMap`'s table has grown to the size it is read
  at. Each reads the median of three rounds from a collected heap (`hold`), so
  a pointer kept per operation shows in every round while a one-off lands in
  one and drops out, and a row that reaches its bound fails the project after
  the rows are written. `bench-extension-<package>.yml`
  runs it on every pull request that changes the package's source, manifest,
  lockfile, `tsconfig.json` or `bench/`, or the shared `bench/`, through the
  reusable `bench.yml`, and posts the table as a comment per package with
  `GITHUB_TOKEN`. A project of the branch that fails fails the job; so does
  the comparison — a count that grew, a row gone missing, a project of the
  base that failed, though a base over a heap bound is only reported — unless
  the pull request carries that package's `bench-accepted:<package>` label
  (`bench-label.yml` re-runs the job when the label changes). A size that
  grew, a time whose spread lies wholly above the base's with its median up
  by 5% or more and heap held whose spread lies 2 B or more above the base's
  are flagged for review; a
  spread leaves out the lowest and the highest quarter of a row's samples,
  rounded down. `publish.yml` writes the package's `BENCH.md` into the
  release commit.

## Tech stack (per package — same as `base`)

TypeScript ESM (`"type": "module"`, `strict`), npm with `package-lock.json`,
`svelte-package` build to `dist/`, Vitest + `vite-plugin-svelte`, ESLint 10
flat config, Node 22+, `svelte >=5` peer.

## The `@sveltekit-i18n/base` dependency

`base` is a **peer dependency** — the consumer brings the instance an extension
wraps, so a package must never bundle its own copy. `devDependencies` carry
the current core to build and test against. The peer range is
`^3.1.0-next.0`: `extension-stores` and `extension-typed-access` pass through
`hydrate()` and `loadNamespace()`, which base 3.1 adds, so they take the
core's `3.1.0-next` line and every stable 3.x from 3.1.0, and no 3.0 core. The range stays once
3.1.0 is stable: narrowing it would fail an app still on one of those
prereleases. They also pass through `preload()`, which base 3.3 adds, without
raising the range: `sveltekit-i18n` pins its core exactly, so npm refuses
(`ERESOLVE`) to add a package whose peer range that core falls outside, and a
fresh install of both puts a second core beside the pinned one. On an earlier core
the member is `undefined` on `extension-stores`' output, whose `Output` types
it so, and absent from `extension-typed-access`' output and its types, which
read the core's own members — so a declaration never names a member the
consumer's core lacks.
`extension-html` uses nothing of 3.1 and takes the parsers'
range, `^3.0.0 || ^3.1.0-next.0`. `npm install` inside a package is the whole setup.

`extension-typed-access` also tests its composition with `extension-stores`
(`[typedAccess, stores]`), against the published stores its lockfile holds.
Before a release of `extension-stores`, run typed-access's suite against the
stores on `master`: `npm ci && npm run build && npm pack` in `extension-stores`,
then `npm i --no-save ../extension-stores/<tarball>` and `npm test` in
`extension-typed-access`.

`extension-typed-access` reads the levels `@sveltekit-i18n/typegen` registers
(`SvelteKitI18n.Register['tree']`: the literal `keys` and the `patterns` they
were built from, apart, and `next`, the root of
`SvelteKitI18n.Typegen.K<hash>.Level*` interfaces of `{ key?, open?, next? }`
nodes), and groups the keys itself whenever they are absent or either set
differs from the instance's schema's. The key sets compare by assignability
both ways, and the literals are read off the schema member by member only
where the tree has patterns, since `keyof` drops a literal a pattern matches:
an identity check of a large key set beside a pattern is quadratic, and no
counter of `cost.spec.ts` sees that, so measure the check time of a change to
the guard. Its `tests/types/tree/schema.d.ts` is typegen's output, pasted: when typegen's format changes, regenerate it with typegen's
`emit`, and before a release of either package, compile that program against
an artifact typegen's `master` emits.

A release is planned with the rest of the family (base's §4, *Releases*):
after `base`, before `sveltekit-i18n`. Each package's `README.md` is its npm
page, so it describes the version being published, and each of its links
resolves.

`publish.yml` releases one package per run, by trusted publishing, which npm
configures only for a package that exists: a new package's first version is
published by hand (`npm publish --tag next` from its directory), its trusted
publisher is then set to `publish.yml`, and every later release runs the
workflow.

## Extension contract you must respect

- An extension is `(input) => output`, run **once, at construction time**, by
  the `I18n` constructor's left-to-right pipe. It receives a configured
  instance (after the synchronous prefix of the config load).
- An extension that replaces the instance must expose the original under an
  `instance` key as an escape hatch. One that augments it (`extension-html`)
  goes before one whose output is no instance (`extension-stores`), since that
  copies a fixed surface; after one whose output still is one
  (`extension-typed-access`), it augments that output.
- A surface whose types follow the core's members forwards them the same
  way at runtime: `extension-typed-access` types every member of the core, so
  it forwards every member the instance has, own or inherited, never a list,
  and a member a core adds reaches it without a release.
- Memoize per instance (`WeakMap`) so double application is harmless.
- Extension packages must not break when applied directly
  (`extension(new I18n(config))`) — tests call them that way.

## Comments

If you need a paragraph-long comment to justify why the workaround is OK,
the code is wrong — fix the code.
