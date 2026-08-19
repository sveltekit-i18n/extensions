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
| `locale` | **writable** | The active locale. Setting it (`locale.set('en')`, `$locale = 'en'`) triggers a fire-and-forget locale switch; the store emits once the switch completes. A falsy value is ignored, exactly as it is on the instance. For an awaitable switch, use `setLocale`. |
| `locales` | readable | All configured locales. |
| `loading` | readable | `true` while translation loads are in flight. |
| `initialized` | readable | `true` once the first translations have been loaded. |
| `translations` | readable | The loaded translation tables. |
| `rawTranslations` | readable | The loaded translation tables before preprocessing. |

### Methods

`loadTranslations`, `setLocale`, `setRoute`, `loadConfig`, `addTranslations`, `invalidate`, `snapshot` and `destroy` are passed through from the instance, pre-bound — safe to destructure.

### `instance`

The untouched `I18n` instance, as an escape hatch to the full runes-based API.

## Migrating from v2

The store shape matches sveltekit-i18n v2 with these differences:

- `loading.toPromise()` was removed — await `loadTranslations` / `setLocale` / `setRoute` directly.
- `locale.forceSet()` was removed — use `invalidate()` plus `setLocale()`.

## Issues

Please report issues [here](https://github.com/sveltekit-i18n/lib/issues).
