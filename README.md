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

## Available Extensions

See the per-package READMEs for installation and usage.

## Creating Custom Extensions

You don't need this repository to write an extension — any function works:

```ts
import I18n from '@sveltekit-i18n/base';

const withGreeting = <T extends { locale: unknown }>(i18n: T) => ({
  ...i18n,
  greet: () => `Hello from ${String(i18n.locale)}!`,
});

const i18n = new I18n({ ...config, extensions: [withGreeting] });
i18n.greet();
```

Guidelines:

- Extensions run at construction time, once, after the synchronous prefix of the config load — they receive a configured instance (with synchronous `translations` and `initLocale`, the initial locale is already active).
- If your extension replaces the instance, expose the original one under an `instance` key so consumers keep an escape hatch to the full API.
- Memoize per instance (e.g. via a `WeakMap`) if your extension may be applied to the same instance more than once.

See the [`@sveltekit-i18n/base` docs](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md) for the full `extensions` reference.

## Issues

This repository is a part of the [sveltekit-i18n](https://github.com/sveltekit-i18n/lib) ecosystem. Please report issues [here](https://github.com/sveltekit-i18n/lib/issues).
