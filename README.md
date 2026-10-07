# sveltekit-i18n extensions

Official extensions for the [`@sveltekit-i18n/base`](https://github.com/sveltekit-i18n/base) `config.extensions` pipe.

An extension is a plain function `(input) => output`. The `I18n` constructor pipes the freshly configured instance through every extension in `config.extensions`, left to right, and `new I18n(config)` evaluates to the last extension's output:

```ts
import I18n from '@sveltekit-i18n/base';

const i18n = new I18n({
  ...config,
  extensions: [extensionA, extensionB],
}); // = extensionB(extensionA(instance))
```

An extension can augment the instance (attach new capabilities) or replace it entirely with a different consumption surface. The result type is inferred end to end — TypeScript folds the instance type through the `extensions` tuple.

The snippets below import `I18n` from `@sveltekit-i18n/base`. With [`sveltekit-i18n`](https://github.com/sveltekit-i18n/lib), import it from `sveltekit-i18n`, which brings the parser, and do not install base beside it: the app would end up with two copies of the core.

## Available Extensions

### [@sveltekit-i18n/extension-stores](https://github.com/sveltekit-i18n/extensions/tree/master/extension-stores)

Replaces the runes-based instance with the Svelte-store surface known from sveltekit-i18n v2 (`$t`, `$locale`, `$loading`, ...), plus pass-through methods and an `instance` escape hatch.

```sh
npm i -D @sveltekit-i18n/base @sveltekit-i18n/extension-stores
```

```ts
import I18n from '@sveltekit-i18n/base';
import stores from '@sveltekit-i18n/extension-stores';

export const { t, locale, loading, loadTranslations } = new I18n({
  ...config,
  extensions: [stores],
});
```

See the [package README](https://github.com/sveltekit-i18n/extensions/tree/master/extension-stores#readme) for the full output reference and v2 migration notes.

### [@sveltekit-i18n/extension-html](https://github.com/sveltekit-i18n/extensions/tree/master/extension-html)

Adds a `T` component that renders the markup a translation carries as elements and Svelte components — from an allowlist, with URLs gated by scheme and the payload escaped, no `{@html}`.

```sh
npm i -D @sveltekit-i18n/base @sveltekit-i18n/extension-html
```

```ts
import I18n from '@sveltekit-i18n/base';
import html from '@sveltekit-i18n/extension-html';

export const i18n = new I18n({
  ...config,
  extensions: [html({ onReport: null })],
});
```

```svelte
<i18n.T key="intro" params={{ name }} />
```

See the [package README](https://github.com/sveltekit-i18n/extensions/tree/master/extension-html#readme) for the component map, the allowlists and the parsers it works with.

### [@sveltekit-i18n/extension-typed-access](https://github.com/sveltekit-i18n/extensions/tree/master/extension-typed-access)

Adds typed member access, `t.cart.summary.itemCount({ count: 3 })`, beside `t('cart.summary.itemCount', { count: 3 })`: the tree is typed from the app's schema and every call goes through the instance's own `t`.

```sh
npm i -D @sveltekit-i18n/base @sveltekit-i18n/extension-typed-access
```

```ts
import I18n from '@sveltekit-i18n/base';
import typedAccess from '@sveltekit-i18n/extension-typed-access';

export const i18n = new I18n({
  ...config,
  extensions: [typedAccess],
});
```

[`@sveltekit-i18n/typegen`](https://github.com/sveltekit-i18n/typegen) generates the schema, and from typegen 3.1 also registers its keys nested by segment, which the tree is read off instead of grouping the keys on every compile (see [Cost](https://github.com/sveltekit-i18n/extensions/tree/master/extension-typed-access#cost)).

It composes with `extension-stores` placed after it (`extensions: [typedAccess, stores]`). See the [package README](https://github.com/sveltekit-i18n/extensions/tree/master/extension-typed-access#readme) for the reserved names, the pipe order and the output reference.

## Combining Extensions

`extension-stores` goes last, since its output is no instance and the other two need one: `extensions: [typedAccess, html({ onReport: null }), stores]` hands out `$t` with the tree, `$t.home.title()`, and the `T` component at `instance.T`.

## Creating Custom Extensions

You don't need this repository to write an extension — any function works:

```ts
import I18n, { type Extension } from '@sveltekit-i18n/base';

interface WithGreeting extends Extension.Operator {
  readonly output: this['input'] & { greet: () => string };
}

const withGreeting: Extension.Generic<WithGreeting> = (i18n: I18n) => Object.assign(i18n, {
  greet: () => `Hello from ${i18n.locale}!`,
});

// Typed as the instance & { greet: () => string } — schema and locales intact:
const i18n = new I18n({ ...config, extensions: [withGreeting] });
i18n.greet();
```

`Object.assign` augments the instance in place, so its members — `t`, `l`, `locale`, `loading` and the rest, getters on the class — keep working. A spread (`{ ...i18n, greet }`) copies none of them: they live on the prototype, not on the instance.

`Extension.Operator` types the output by the surface the extension receives, so the `schema` and the locale union the config narrowed survive the pipe. An extension typed by a fixed return type contributes that type and erases the instance's type parameters; a generic signature (`<T>(i18n: T) => …`) erases the whole surface, since the pipe reads it with `T` at its constraint.

Guidelines:

- Extensions run at construction time, once, after the synchronous prefix of the config load — they receive a configured instance (with synchronous `translations` and `initLocale`, the initial locale is already active).
- If your extension replaces the instance, expose the original one under an `instance` key so consumers keep an escape hatch to the full API.
- Memoize per instance (e.g. via a `WeakMap`) if your extension may be applied to the same instance more than once.

See the [`@sveltekit-i18n/base` docs](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md) for the full `extensions` reference.

## Documentation

- 🌐 [sveltekit-i18n.github.io](https://sveltekit-i18n.github.io) – The documentation site, with a live playground
- 📖 [@sveltekit-i18n/base docs](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md) – The core, and the `extensions` reference
- 📚 [Documentation Index](https://github.com/sveltekit-i18n/lib/tree/master/docs/INDEX.md) – Guides, tutorials and best practices
- 💡 [Examples](https://github.com/sveltekit-i18n/lib/tree/master/examples#extensions) – A SvelteKit app on each extension

## Issues

This repository is a part of the [sveltekit-i18n](https://github.com/sveltekit-i18n/lib) ecosystem. Please report issues [here](https://github.com/sveltekit-i18n/lib/issues).

## Sponsor

You can support the maintenance of these packages through
[GitHub Sponsors](https://github.com/sponsors/sveltekit-i18n).
