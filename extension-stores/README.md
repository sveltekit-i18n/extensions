# @sveltekit-i18n/extension-stores

A [Svelte store](https://svelte.dev/docs/svelte/stores) consumption mode for [`@sveltekit-i18n/base`](https://github.com/sveltekit-i18n/base) v3.

Base v3 exposes one runes-based reactive instance. This extension replaces that surface with the store-shaped API known from v2 — for consumers who prefer `$t(...)` auto-subscriptions, or are migrating gradually.

## Install

```sh
npm i -D @sveltekit-i18n/base @sveltekit-i18n/extension-stores
```

With [`sveltekit-i18n`](https://github.com/sveltekit-i18n/lib), install the extension alone — the core comes with it — and import `I18n` from `sveltekit-i18n` where a snippet here imports it from `@sveltekit-i18n/base`, so the instance gets its parser:

```sh
npm i -D @sveltekit-i18n/extension-stores
```

On `sveltekit-i18n` 3.0, pin the extension's 3.0 line (`npm i -D @sveltekit-i18n/extension-stores@3.0`): this release needs a 3.1 core (see [Upgrading from 3.0](#upgrading-from-30)).

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

## Pipe order

The output is no instance, so this extension goes after every extension that needs one — placed after it, `typedAccess` and `html` throw at construction — and the stores follow what the extension before it hands over:

- **`[typedAccess, stores]`**: [`extension-typed-access`](https://github.com/sveltekit-i18n/extensions/tree/master/extension-typed-access) hands its tree to `$t`, `$t.home.title()` beside `$t('home.title')`, typed from the schema. `instance` is its output, and `instance.instance` the core.
- **`[html(…), stores]`**: the stores carry no `T`; [`extension-html`](https://github.com/sveltekit-i18n/extensions/tree/master/extension-html)'s component is at `instance.T`.
- **`[typedAccess, html(…), stores]`** does both: `$t` carries the tree, and `instance.T` is the component.


## Output

### Stores

Every store also carries a `get()` method for a subscription-free read of the current value.

In the browser the stores follow the instance from the microtask after the extension ran, for as long as the instance lives, whether or not anything subscribes. A subscription starts with the instance's current value, and a change made before that microtask reaches the subscribers at it. `get()` reads the instance directly and never lags. Within one update, a store emits after the stores its value derives from: the tables, then `locale`, then `initialized`, `t` and `l`. A component mounted after that microtask renders a `$t(...)` once per change, unless something schedules the app's update ahead of the change; then it renders it twice. That is a write earlier in the same update to other state the app renders, a change made inside Svelte's own update (as a `$effect.pre` switching the locale does), or an instance built in the same synchronous task that mounts the app.

| Store | Type | Description |
|-------|------|-------------|
| `t` | readable | Translation function for the active locale: `$t('key', ...params)`. A fresh function is emitted whenever the translations, the locale or the config change. |
| `l` | readable | Locale-explicit translation function: `$l('en', 'key', ...params)`. A fresh function is emitted whenever the translations or the config change; a locale switch alone emits none, since the locale is an argument. |
| `locale` | **writable** | The active locale. Setting it (`locale.set('en')`, `$locale = 'en'`) triggers a fire-and-forget locale switch; the store emits once the switch completes. A falsy value is ignored, exactly as it is on the instance. A switch that a loader's SvelteKit `redirect()` or `error()` below 500 rejects is only logged: the store stays on the old locale and does not emit, so a `<select bind:value={$locale}>` keeps showing the refused option. For an awaitable switch that receives the rejection, use `setLocale`. |
| `locales` | readable | All known locales: the loaders' and those of loaded or added translations. |
| `loading` | readable | `true` while a load that switches the locale or the route is in flight — `setLocale`, `setRoute`, `loadTranslations` or setting `locale`. A load of `loadNamespace()`, `preload()` or `loadTranslations(…, { activate: false })` does not count unless an activating call joins it; await what they return instead. |
| `initialized` | readable | `true` once a locale and route are set and translations are present. |
| `translations` | readable | The loaded translation tables. |
| `rawTranslations` | readable | The loaded translation tables before preprocessing. |

### Methods

`loadTranslations`, `preload`, `loadNamespace`, `setLocale`, `setRoute`, `loadConfig`, `addTranslations`, `invalidate`, `snapshot`, `hydrate` and `destroy` are passed through from the instance, pre-bound — safe to destructure. See the [base docs](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md) for what each does. [`preload()`](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md#preloadlocale-route) comes with base 3.3, which `sveltekit-i18n` carries from 3.4.0: on an earlier core, `preload` is `undefined`, and typed so.

### Server-rendered apps

With SvelteKit, [`@sveltekit-i18n/base/kit`](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md#sveltekit) does the whole hand-off. Put the extension in the config it wires, and `data.i18n`, `use()` and `get()` hand out the stores; the hook, the layouts and `use()` stay as its setup shows. With `sveltekit-i18n` 3.1 or newer, import `defineI18n` from `sveltekit-i18n/kit` instead:

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

On the server, Svelte's stores do not track the instance: a subscription reads its value from the instance when it starts and gets nothing after that. A render therefore shows what the pass had loaded by then — load before rendering, as the `/kit` load and the SSR recipe do.

### `instance`

The instance the extension received, as an escape hatch to the full runes-based API: the core when the extension runs alone, the output of the extension before it otherwise ([pipe order](#pipe-order)).

## Upgrading from 3.0

- Requires `@sveltekit-i18n/base` 3.1 or newer. With `sveltekit-i18n`, that is `sveltekit-i18n` 3.1 or newer: on 3.0, the instance has no `hydrate` or `loadNamespace` to pass through.
- `hydrate()` and `loadNamespace()` are passed through, and `invalidate()` takes base 3.1's `namespace` argument.
- Setting the `locale` store no longer always switches: a switch a loader's `redirect()` or `error()` below 500 rejects leaves the store on the old locale. Use `setLocale` to receive the rejection.
- On the server, a store no longer reports what the instance held when the extension ran, before anything had loaded: each subscription reads the instance when it starts.
- Handing translations over through `config.translations` or `addTranslations()` no longer counts as loaded, so the client fetches them again: switch to `hydrate()` (see [Server-rendered apps](#server-rendered-apps)).

## Migrating from v2

The store shape matches sveltekit-i18n v2 with these differences:

- `loading.toPromise()` was removed — await `loadTranslations` / `setLocale` / `setRoute` directly.
- `locale.forceSet()` was removed — use `invalidate()` plus `setLocale()`.

## Documentation

- 🌐 [sveltekit-i18n.github.io](https://sveltekit-i18n.github.io) – The documentation site, with a live playground
- 📖 [@sveltekit-i18n/base docs](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md) – The core, and the `extensions` reference
- 📚 [Documentation Index](https://github.com/sveltekit-i18n/lib/tree/master/docs/INDEX.md) – Guides, tutorials and best practices
- 💡 [Example](https://github.com/sveltekit-i18n/lib/tree/master/examples/stores) – A SvelteKit app on the store surface

## Issues

Please report issues [here](https://github.com/sveltekit-i18n/lib/issues).

## Sponsor

You can support the maintenance of this package through
[GitHub Sponsors](https://github.com/sponsors/sveltekit-i18n).
