# @sveltekit-i18n/extension-typed-access

Typed member access for [`@sveltekit-i18n/base`](https://github.com/sveltekit-i18n/base) v3: `t.cart.summary.itemCount({ count: 3 })` beside `t('cart.summary.itemCount', { count: 3 })`.

The member form completes each segment as you type, takes you to the key's payload type, and renames with the schema. It is a typed convenience over the same runtime: every call goes through the instance's own `t`, so a key resolves, falls back and fails soft exactly as the string form does. Keys that are only known at runtime (CMS content, `t(item.labelKey)`) keep the string form.

## Install

```sh
npm i -D @sveltekit-i18n/base @sveltekit-i18n/extension-typed-access
```

With [`sveltekit-i18n`](https://github.com/sveltekit-i18n/lib), install the extension alone — the core comes with it — and import `I18n` from `sveltekit-i18n` where a snippet here imports it from `@sveltekit-i18n/base`, so the instance gets its parser:

```sh
npm i -D @sveltekit-i18n/extension-typed-access
```

It needs a 3.1 core or newer (`sveltekit-i18n` 3.1 or newer): it passes `loadNamespace()` and `hydrate()` through.

## Usage

Add the extension to `config.extensions`:

```ts
import I18n from '@sveltekit-i18n/base';
import typedAccess from '@sveltekit-i18n/extension-typed-access';

export const i18n = new I18n({
  ...config,
  extensions: [typedAccess],
});
```

```svelte
<h1>{i18n.t.home.title()}</h1>
<p>{i18n.t.cart.summary.itemCount({ count: 3 })}</p>
<p>{i18n.t('cart.summary.itemCount', { count: 3 })}</p>
```

The extension can also be applied to an existing instance directly — `typedAccess(i18n)` returns the same output (memoized per instance).

**The tree is typed from the schema.** [`@sveltekit-i18n/typegen`](https://github.com/sveltekit-i18n/typegen) generates it and registers it for the app, with its keys already nested by segment (see [Cost](#cost)), or a config states it in [`schema`](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md#schema). A leaf takes the payload its key takes in the string form, and a key outside the schema is a type error. Without a closed schema there is no tree to type: `t` stays the plain function, while `t.any.thing()` still resolves at runtime like `t('any.thing')`. As with any extension, a config kept in a variable is typed through the pipe only `as const` (see [Extensions and the constructor's type](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md#extensions-and-the-constructors-type)).

Reading `t` is reactive wherever the instance's `t` is: `{i18n.t.home.title()}` re-renders on a locale switch like `{i18n.t('home.title')}`, and so does a `t` destructured inside a `$derived`.

## The tree

- **A leaf call** is `t('dotted.path', ...params)`, with the params passed on unchanged. A key that is also a prefix of others is both a leaf and a namespace: `t.a()` and `t.a.b()`. A segment that is no identifier reads with brackets: `t.list[0]()`, `` t['odd key']() ``.
- **A key pattern** types the tree only in the shape `` `prefix.${string}` ``, the one [`typegen`](https://github.com/sveltekit-i18n/typegen) writes for a namespace it leaves open: the node at its prefix is open. Below it any segment, a name a function answers included, and any path takes any params, whatever payload the pattern types, so an open node is no `Function` to TypeScript. A literal key beside it keeps its own payload, and what the pattern matches below it stays open: `t.cms.title({ x })` and `t.cms.title.sub()`; a node on the way to a literal key takes the payload the string form gives it (`t.x.y({ p: 1 })` beside `x.y.z` and `` `x.${string}`: { p: 1 } ``). Any other pattern (`` `${string}.label` ``, `` `row${number}` ``, `` `${string}.${string}` ``) is reached through the string form, even where it matches below a literal key. Under `noUncheckedIndexedAccess` an open segment reads as possibly `undefined`, so reach those keys through the string form.
- **A key the tables lack** degrades exactly like the string form — `t.nope.x()` gives what `t('nope.x')` gives — never a `TypeError`, whether the key is unknown or its locale or route has not loaded yet.
- **Reserved names.** At the first level, the names a function answers read the real `t`: `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `__lookupSetter__`, `__proto__`, `apply`, `arguments`, `bind`, `call`, `caller`, `constructor`, `hasOwnProperty`, `isPrototypeOf`, `length`, `name`, `propertyIsEnumerable`, `toLocaleString`, `toString` and `valueOf`. `RESERVED` exports them, with `then` (below). A namespace of one of those names is reached through the string form: `t('name.first')`. Below the first level every name is a segment — `t.form.name()` is the key `form.name` — so a leaf has no `call`, `apply`, `bind`, `length` or `name`, and the types say so. Wrap a leaf you hand to code that uses them: `(params) => t.cart.count(params)`. At the first level, `t.prototype` is typed `never` unless a key lies under `prototype`; before TypeScript 5.4 such a key leaves `t.prototype` typed `any`, as a function's own `prototype` is.
- **`then` and symbol keys** answer `undefined` at every level, so a node is never a thenable or an iterable: `await`, `Promise.resolve()` or returning a node from a `load` settles to the node itself. A key under `then` is reached through the string form.
- **A forgotten call** (`{t.home.title}`) renders the missing-key text of the coercion that ran, such as `home.title.toString`: the server and the client may run different ones inside an interpolated attribute. It is only text while a miss is text: with an object [`fallbackValue`](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md#fallbackvalue), a forgotten call throws. Markup accepts a function, so `svelte-check` does not catch one; a `string` annotation does.
- **Nothing is written through the tree:** assigning or deleting a member, `Object.preventExtensions()` or `Object.setPrototypeOf()` throws a `TypeError`, and the instance's `t` stays untouched.

## Pipe order

- **`[typedAccess, stores]`** works: [`extension-stores`](https://github.com/sveltekit-i18n/extensions/tree/master/extension-stores) then hands out the tree, `$t.home.title()`.
- **`[typedAccess, html(…)]`** works: [`extension-html`](https://github.com/sveltekit-i18n/extensions/tree/master/extension-html) adds `T` to the output, beside the tree. Placed before this one, `[html(…), typedAccess]`, `T` is typed at `instance.T` only.
- **`[stores, typedAccess]`** cannot: the stores surface is no instance. The output types as `never`, and the constructor throws a `TypeError`: `` [i18n]: `typedAccess` takes an instance: put it before any extension whose output is no instance, such as `stores`. ``
- The output forwards every member of the instance it receives, and the types every member of the core. A member another extension adds is typed on the output when that extension runs after this one; one that runs before it is typed on `instance` only, so reach it there. Applied again, the extension hands its own output back unchanged, members added to it in place included. The types take an extension typed as its input plus members to add them in place: one that returns another object says so by typing it with an `instance` of its own, naming what it replaced, as extension-stores does. The types count the outputs of this extension under a type rather than tell which ones: a surface that types its `instance` as a plain instance reads as the output it spreads, and a type without the output's `'~typedAccess'` (a `Pick`, an interface written by hand) as an instance. `Omit` keeps it.

## Output

A new object, not the instance: the instance's `t` is a `$derived` field and cannot be replaced in place.

| Member | Kind | Description |
|--------|------|-------------|
| `t` | getter | The instance's `t`, callable as before and carrying the tree. A new function whenever the instance's `t` changes, as on the instance. Assigning it throws a `TypeError`. |
| `locale`, `l`, `locales`, `loading`, `initialized`, `translations`, `rawTranslations` | accessors | Read from the instance whenever they are read, and assigned to it where the instance takes the assignment; where it does not, assigning throws a `TypeError`, as it does there: `locale` always takes one, `translations` and `rawTranslations` never do, and whether `l`, `locales`, `loading` and `initialized` do is up to the Svelte that compiles the core (their `$derived` fields). Setting `locale` is the instance's fire-and-forget locale switch. |
| `loadTranslations`, `preload`, `loadNamespace`, `setLocale`, `setRoute`, `loadConfig`, `addTranslations`, `invalidate`, `snapshot`, `hydrate`, `destroy` | methods | Passed through from the instance, pre-bound — safe to destructure. See the [base docs](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md) for what each does. [`preload()`](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md#preloadlocale-route) comes with base 3.3, which `sveltekit-i18n` carries from 3.4.0: on an earlier core the output has no `preload`, and the types leave it out. |
| `instance` | value | The untouched `I18n` instance, as an escape hatch. Its `t` has no tree. |
| `'~typedAccess'` | type only | Never present at runtime: it counts the outputs of this extension down to the instance, this one included, which lets the types tell an output from another extension's surface over it. Neither read it nor test for it with `in`. |

The rows above are the members of a base 3.3 core. The output forwards whatever members the instance has when the extension runs, own or inherited, so a member a later core adds reaches it without a release of this package. A method is passed through, bound to the instance where its prototype holds it; any other member is read from the instance whenever it is read, and assigned to it where the instance takes the assignment. What every object answers (`constructor`, `toString`, …) stays the output's own.

The output stays typed as an instance, so the `schema`, the locale union and any `Extension.Operator` after this one keep working. Two objects are in circulation: code handed `instance` gets `t` without the tree, and `output instanceof I18n` does not hold.

### Server-rendered apps

With SvelteKit, [`@sveltekit-i18n/base/kit`](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md#sveltekit) does the whole hand-off. Put the extension in the config it wires, and `data.i18n`, `use()` and `get()` hand out the tree. With `sveltekit-i18n` 3.1 or newer, import `defineI18n` from `sveltekit-i18n/kit` instead:

```js
// src/lib/i18n.js
import { defineI18n } from '@sveltekit-i18n/base/kit';
import typedAccess from '@sveltekit-i18n/extension-typed-access';

export const { handle, load, use, get } = defineI18n({ ...config, extensions: [typedAccess] });
```

```svelte
<!-- any component below the root layout -->
<script>
  import { get } from '$lib/i18n';

  const i18n = get();
</script>

<p>{i18n.t.common.greeting()}</p>
```

### Libraries

A library that exports an instance built with the extension keeps the tree in its emitted declarations: the tree is read back through the declared `t`. For the same reason, `typedAccess()` takes an instance a library exports without it. When the extension ends the pipe, applied once, the declarations name the output by the `Wrapped` type this package exports, so a library that emits them lists the package among its dependencies. After another extension, or applied again, they spell the tree out, which a generic schema does not survive and a large one outgrows (TS7056): annotate such an export over a concrete schema, e.g. `Wrapped<I18n<Parser.Params, string, Schema>> & { extra: number }`, and let a factory over a generic schema end its pipe with the extension, applied once. Build the instance into a local first and annotate the export it is assigned to with that type (`const built = new I18n(…); export const i18n: Out = built;`): the declarations are the same, while an annotation on the `new I18n(…)` expression itself checks far slower as the schema grows.

## Cost

A member call builds one proxy per segment on top of the string form's lookup: measured on Node 22, about 0.5 µs more for a three-segment key.

The checker builds the tree as soon as a module reads any member of the output — `t` in either form, but also `locale` or `setLocale` — a level at a time: the root once, and a namespace the first time a member under it is read. A call through the tree reads its payload off its own key rather than the whole schema, so further calls add little. What a level costs depends on where the tree comes from.

**The levels [`typegen`](https://github.com/sveltekit-i18n/typegen) registers.** From typegen 3.1 the generated file also registers the keys already nested by segment, and the tree is read off them: a level costs its own segments, once, whatever the size of the schema and however its keys are spread. They type an instance only where they were built from exactly its keys — a config stating the generated interface (`schema: {} as TranslationSchema`) included. An instance whose schema holds a key typegen did not write — one the app declares beside the generated ones, under a namespace typegen left open too, or a schema a config states with other keys — groups its keys here, as below, and so does an app on an earlier typegen. A namespace typegen left open costs about 0.4 s more on 10,000 keys, once: the check that the literal keys beside it are the generated ones.

**Grouped here.** Otherwise a level gathers the keys under each of its segments one key at a time, so it costs, for each segment, the square of the number of keys under it: spread over many namespaces, a schema costs about what its keys do, while one namespace holding them all costs their square.

Measured with TypeScript 5.9 on base 3.2.0, with a schema of 10,000 keys grouped here, one call through the tree checked in 1.1 s over flat keys, 1.5 s over 500 namespaces of 20 keys, 3.1 s over six-segment keys under five top-level segments and 8.4 s over a single namespace; 200 calls took 1.1, 1.7, 3.7 and 9.0 s. A single namespace of 1,000, 2,000 and 5,000 keys took 0.4, 0.7 and 2.2 s, against 0.3, 0.4 and 0.6 s in namespaces of 20. Two key patterns beside the six-segment keys, or over two of their top-level segments, took the tree to 9.4–11 s. On another machine, where the four schemas grouped here took 1.2–7.5 s for one call and 1.3–7.7 s for 200, the levels typegen registers took 0.7–0.8 s and 0.9–1.1 s.

The string form without the extension depends on the core. Before base 3.3.0 a call reads the whole schema; on base 3.2.0 one call took 0.3 s and 200 calls 3.7–4.0 s, 5.3 s and 37 s with the two patterns, and 1,000 calls into 20,000 keys in namespaces of 20 took 37 s, where the tree took 3.5 s. From base 3.3.0, which carries the fix for [lib#298](https://github.com/sveltekit-i18n/lib/issues/298), a call reads only its own key, and 200 calls took 0.4–0.6 s on every schema above — below the tree grouped here, which that core changes little.

Grouped here, the tree's cost is in its largest group of keys under one segment, not in the size of the schema: generate the schema with typegen, or keep namespaces to hundreds of keys, and leave the extension off an instance whose schema holds thousands under one segment without the levels typegen registers, since its string form builds the tree too.

## Documentation

- 🌐 [sveltekit-i18n.github.io](https://sveltekit-i18n.github.io) – The documentation site, with a live playground
- 📖 [@sveltekit-i18n/base docs](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md) – The core, and the `extensions` reference
- 📚 [Documentation Index](https://github.com/sveltekit-i18n/lib/tree/master/docs/INDEX.md) – Guides, tutorials and best practices
- 💡 [Example](https://github.com/sveltekit-i18n/lib/tree/master/examples/typed-access) – A SvelteKit app that reads its keys through the tree

## Issues

Please report issues [here](https://github.com/sveltekit-i18n/lib/issues).

## Sponsor

You can support the maintenance of this package through
[GitHub Sponsors](https://github.com/sponsors/sveltekit-i18n).
