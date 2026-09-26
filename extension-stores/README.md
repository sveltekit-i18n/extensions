# @sveltekit-i18n/extension-stores

A [Svelte store](https://svelte.dev/docs/svelte/stores) consumption mode for [`@sveltekit-i18n/base`](https://github.com/sveltekit-i18n/base) v3.

Base v3 exposes one runes-based reactive instance. This extension replaces that surface with the store-shaped API known from v2 — for consumers who prefer `$t(...)` auto-subscriptions, or are migrating gradually.

## Install

```sh
npm i -D @sveltekit-i18n/base @sveltekit-i18n/extension-stores
```

## Usage

Add the extension to `config.extensions` — `new I18n(...)` then evaluates to the store-shaped output:

```ts
import I18n from '@sveltekit-i18n/base';
import stores from '@sveltekit-i18n/extension-stores';

export const { t, l, locale, loading, loadTranslations } = new I18n({
  ...config,
  extensions: [stores],
});
```

```svelte
<h1>{$t('common.title')}</h1>
```

The extension can also be applied to an existing instance directly — `stores(i18n)` returns the same output (memoized per instance).

The output is typed from the instance it wraps, so what the config narrows — the `schema` keys and payloads behind `t`/`l`, the locale union behind `locale` and `setLocale` — survives the pipe.

## Output

### Stores

Every store also carries a `get()` method for a subscription-free read of the current value.

| Store | Type | Description |
|-------|------|-------------|
| `t` | readable | Translation function for the active locale: `$t('key', ...params)`. A fresh function is emitted whenever the translations, the locale or the config change. |
| `l` | readable | Locale-explicit translation function: `$l('en', 'key', ...params)`. Emitted the same way as `t`. |
| `locale` | **writable** | The active locale. Setting it (`locale.set('en')`, `$locale = 'en'`) triggers a fire-and-forget locale switch; the store emits once the switch completes. A falsy value is ignored, exactly as it is on the instance. A switch that a loader's SvelteKit `redirect()` or `error()` below 500 rejects is only logged: the store stays on the old locale and does not emit, so a `<select bind:value={$locale}>` keeps showing the refused option. For an awaitable switch that receives the rejection, use `setLocale`. |
| `locales` | readable | All configured locales. |
| `loading` | readable | `true` while a load that switches the locale or the route is in flight — `setLocale`, `setRoute`, `loadTranslations` or setting `locale`. `loadNamespace()` and `loadTranslations(…, { activate: false })` do not count; await what they return instead. |
| `initialized` | readable | `true` once the first translations have been loaded. |
| `translations` | readable | The loaded translation tables. |
| `rawTranslations` | readable | The loaded translation tables before preprocessing. |

### Methods

`loadTranslations`, `loadNamespace`, `setLocale`, `setRoute`, `loadConfig`, `addTranslations`, `invalidate`, `snapshot`, `hydrate` and `destroy` are passed through from the instance, pre-bound — safe to destructure. See the [base docs](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md) for what each does.

### Server-rendered apps

With SvelteKit, [`@sveltekit-i18n/base/kit`](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md#sveltekit) does the whole hand-off. Put the extension in the config it wires, and `data.i18n`, `use()` and `get()` hand out the stores; the hook, the layouts and `use()` stay as its setup shows:

```js
// src/lib/i18n.js
import { defineI18n } from '@sveltekit-i18n/base/kit';
import stores from '@sveltekit-i18n/extension-stores';

export const { handle, load, use, get } = defineI18n({ ...config, extensions: [stores] });
```

```svelte
<!-- any component below the root layout -->
<script>
  import { get } from '$lib/i18n';

  const { t } = get();
</script>

<p>{$t('common.greeting')}</p>
```

Wiring it by hand, follow base's [SSR recipe](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md#server-side-rendering): `snapshot()` and `hydrate()` are passed through, and a component reads `$t(...)` from the stores where the recipe calls `i18n.t(...)`. Hand the translations over through `hydrate()`, not through `config.translations` or `addTranslations()`: those only seed the tables, so the client fetches them again.

### `instance`

The untouched `I18n` instance, as an escape hatch to the full runes-based API.

## Upgrading from 3.0

- Requires `@sveltekit-i18n/base` 3.1 or newer. With `sveltekit-i18n`, that is a release built on base 3.1: on one built on 3.0, the instance has no `hydrate` or `loadNamespace` to pass through.
- `hydrate()` and `loadNamespace()` are passed through, and `invalidate()` takes base 3.1's `namespace` argument.
- Setting the `locale` store no longer always switches: a switch a loader's `redirect()` or `error()` below 500 rejects leaves the store on the old locale. Use `setLocale` to receive the rejection.
- Handing translations over through `config.translations` or `addTranslations()` no longer counts as loaded, so the client fetches them again: switch to `hydrate()` (see [Server-rendered apps](#server-rendered-apps)).

## Migrating from v2

The store shape matches sveltekit-i18n v2 with these differences:

- `loading.toPromise()` was removed — await `loadTranslations` / `setLocale` / `setRoute` directly.
- `locale.forceSet()` was removed — use `invalidate()` plus `setLocale()`.

## Documentation

- 🌐 [sveltekit-i18n.github.io](https://sveltekit-i18n.github.io) – The documentation site, with a live playground
- 📖 [@sveltekit-i18n/base docs](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md) – The core, and the `extensions` reference
- 📚 [Documentation Index](https://github.com/sveltekit-i18n/lib/tree/master/docs/INDEX.md) – Guides, tutorials and best practices

## Issues

Please report issues [here](https://github.com/sveltekit-i18n/lib/issues).

## Sponsor

You can support the maintenance of this package through
[GitHub Sponsors](https://github.com/sponsors/sveltekit-i18n).
