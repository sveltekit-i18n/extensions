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
  this file, `CLAUDE.md`, `.gitignore`, and `.github/workflows/`.

## Tech stack (per package — same as `base`)

TypeScript ESM (`"type": "module"`, `strict`), npm with `package-lock.json`,
`svelte-package` build to `dist/`, Vitest + `vite-plugin-svelte`, ESLint 10
flat config, Node 22+, `svelte >=5` peer.

## The `@sveltekit-i18n/base` dependency

`base` is a **peer dependency** — the consumer brings the instance an extension
wraps, so a package must never bundle its own copy. The same range is mirrored
in `devDependencies` to build and test against. The range is
`^3.1.0-next.0`: `extension-stores` passes through `hydrate()` and
`loadNamespace()`, which base 3.1 adds, so it takes the core's `3.1.0-next`
line and every stable 3.x from 3.1.0, and no 3.0 core. The range stays once
3.1.0 is stable: narrowing it would fail an app still on one of those
prereleases. `extension-html` uses nothing of 3.1 and takes the parsers'
range, `^3.0.0 || ^3.1.0-next.0`. `npm install` inside a package is the whole setup.

A release is planned with the rest of the family (base's §4, *Releases*):
after `base`, before `sveltekit-i18n`. Each package's `README.md` is its npm
page, so it describes the version being published, and each of its links
resolves.

## Extension contract you must respect

- An extension is `(input) => output`, run **once, at construction time**, by
  the `I18n` constructor's left-to-right pipe. It receives a configured
  instance (after the synchronous prefix of the config load).
- An extension that replaces the instance must expose the original under an
  `instance` key as an escape hatch. One that augments it (`extension-html`)
  goes before those in a pipe, since a replacement copies a fixed surface.
- Memoize per instance (`WeakMap`) so double application is harmless.
- Extension packages must not break when applied directly
  (`extension(new I18n(config))`) — tests call them that way.

## Comments

If you need a paragraph-long comment to justify why the workaround is OK,
the code is wrong — fix the code.
