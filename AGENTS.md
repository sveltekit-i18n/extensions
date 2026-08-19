# AGENTS.md

Behavioral guidelines for LLM coding assistants working on the
**sveltekit-i18n extensions** monorepo. Applies to anything that drives
commits, PRs, or file edits on this repo.

**Precedence:** These repo rules override individual LLM memory or personal
preference. If your own memory conflicts with this file, follow this file.

This repo follows the same working rules as
[`base`'s AGENTS.md](https://github.com/sveltekit-i18n/base/blob/master/AGENTS.md)
(sections 1-14: think before coding, simplicity first, surgical changes,
verify before committing, commit on approval, fixup hygiene, branch & push
discipline, PRs, docs track code, coding conventions, security posture,
English-only artifacts, test rules, terse output, no emojis). What follows is
only what differs here.

---

## The repository

Official extensions for the `config.extensions` pipe of
[`@sveltekit-i18n/base`](https://github.com/sveltekit-i18n/base) v3+. Part of
the [sveltekit-i18n](https://github.com/sveltekit-i18n/lib) ecosystem
(`base` / `lib` / `parsers` / `extensions`).

- **Monorepo without workspaces** — like `parsers`: no root `package.json`;
  each `extension-*/` directory is a fully standalone npm package with its own
  `package.json`, lockfile, configs, tests, README, LICENSE, and CHANGELOG.
- The root holds only `README.md` (extension pipe overview + package index),
  this file, `.gitignore`, and `.github/workflows/`.

## Tech stack (per package — same as `base`)

TypeScript ESM (`"type": "module"`, `strict`), npm with `package-lock.json`,
`svelte-package` build to `dist/`, Vitest + `vite-plugin-svelte`, ESLint 10
flat config, Node 22+, `svelte >=5` peer.

## The `@sveltekit-i18n/base` dev dependency

`base` v3 is not published yet, so packages depend on it via
`"@sveltekit-i18n/base": "file:.base"`, where `.base/` is a **gitignored,
locally built clone** produced by `npm run setup:base` (see
`scripts/setup-base.mjs`; `BASE_REF` selects the branch, default `master`).
Install order inside a package therefore is:

```sh
npm run setup:base && npm install
```

Once `base` v3 is on npm, swap the `file:` dev dependency for a registry
version and delete the setup script — flag this when you notice it's possible.

## Extension contract you must respect

- An extension is `(input) => output`, run **once, at construction time**, by
  the `I18n` constructor's left-to-right pipe. It receives a configured
  instance (after the synchronous prefix of the config load).
- An extension that replaces the instance must expose the original under an
  `instance` key as an escape hatch.
- Memoize per instance (`WeakMap`) so double application is harmless.
- Extension packages must not break when applied directly
  (`extension(new I18n(config))`) — tests call them that way.

## Versioning

The whole sveltekit-i18n family starts aligned at **3.0.0**; afterwards each
package versions independently. Compatibility is expressed through
`peerDependencies` ranges (widen, e.g. `^3 || ^4`, rather than releasing an
identical new major).
