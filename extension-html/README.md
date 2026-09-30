# @sveltekit-i18n/extension-html

Renders the markup a translation carries — `Read <a href="/docs">the docs</a>` — as elements and Svelte components, for [`@sveltekit-i18n/base`](https://github.com/sveltekit-i18n/base) v3. No `{@html}`: every element is created by Svelte, from an allowlist.

## Install

```sh
npm i -D @sveltekit-i18n/base @sveltekit-i18n/extension-html
```

With [`sveltekit-i18n`](https://github.com/sveltekit-i18n/lib), install the extension alone — the core comes with it:

```sh
npm i -D @sveltekit-i18n/extension-html
```

## Usage

Add the extension to `config.extensions`. It adds one member to the instance, the `T` component:

```ts
import I18n from '@sveltekit-i18n/base';
import html from '@sveltekit-i18n/extension-html';

export const i18n = new I18n({
  ...config,
  extensions: [html({ onReport: null })],
});
```

```json
{ "intro": "Hi <b>{{name}}</b>, read <a href=\"/docs\">the docs</a>." }
```

```svelte
<i18n.T key="intro" params={{ name }} />
```

renders

```html
Hi <b>Ann</b>, read <a href="/docs">the docs</a>.
```

`T` is a component, so it is used as `<i18n.T>`, or taken off the instance first (`const { T } = i18n`). `t()` and `l()` do not change: they return the message with its markup as text, which is what an attribute, a `<title>` or an `aria-label` needs. Use `<T>` where the markup should render, and `t()` everywhere else.

The extension returns the instance it receives, so `new I18n(...)` stays the instance, `T` included. It can also be applied directly — `html(options)(i18n)` — and applying it twice is harmless.

### Props

| Prop | Description |
|------|-------------|
| `key` | The key of the message. |
| `params` | The payload, as the first param of `t()`. Required where the `schema` requires it. |
| `args` | The parser's params after the payload (ICU's `formats`, for instance), as an array. |
| `locale` | Renders in this locale rather than the active one, as `l()` does. |
| `components` | This usage's layer of the component map (see below). |

`<T>` follows its props, the active locale and the loaded translations, like `t()` in a template. With a `schema`, `key` completes and narrows `params` exactly as `t()` does. A `key` held in a variable typed by a union of keys renders too when none of them needs `params`; a union of keys that do is typed only up to 25 of them, a limit of how TypeScript matches a union of props. TypeScript finds the props of a literal `key` by a lookup rather than comparing a usage with those of every key in turn. It cannot for a key whose payload is optional, for any key of a schema with an open namespace (a template-literal key such as ``[key: `post.${string}`]``), or for a `key` held in a variable typed by a union of keys; with [`@sveltekit-i18n/typegen`](https://github.com/sveltekit-i18n/typegen), that is every key of its keys-only output (payloads `any`) and every key whenever it leaves a namespace open under a `preprocess` other than `'none'`.

## Options

```ts
html({
  onReport: (report) => console.warn(report.message),
  components: { b: 'strong', a: { component: Link, props: { rel: 'noopener' } } },
});
```

| Option | Description |
|--------|-------------|
| `onReport` | Required: where the reports of what a message could not render go (see [Reports](#reports)); `null` discards them. |
| `components` | The app's layer of the component map. |

## The component map

A tag of a translation renders as whatever the map says for it. The map has three layers, and the highest that names a tag decides:

1. the defaults — the inline elements `a`, `b`, `strong`, `i`, `em`, `u`, `s`, `small`, `mark`, `code`, `sub`, `sup`, `br`, `span`, `bdi` and `bdo`, each rendered as itself;
2. the `components` option;
3. the `components` prop of a usage.

An entry is

- a tag name — `b: 'strong'` renders `<b>` as `<strong>`;
- a component — `a: Link` renders `<a>` as `<Link>`, with the attributes of the tag as props and the content as `children`;
- either of them with props of the app's own, laid over the tag's attributes — `a: { component: 'a', props: { class: 'link' } }`;
- `null`, which unmaps a tag a lower layer maps.

A layer's entry replaces a lower layer's entry whole, props included: a usage's `a: Link` drops the `props` the option gave `a`.

A tag no layer maps is unwrapped — its content renders, the tag does not — and reported. Tag names are matched in lower case, as HTML parses them. SVG and MathML are not HTML: their content renders as text, and each of their tags is reported as unmapped.

### Block elements

Block and structural elements are off by default. A `<T>` is often inside a `<p>`, a `<button>` or an `<a>`, which cannot hold a `<p>` or a `<div>`, and the translator who writes the tag cannot know where the message goes: the browser would move the element out of its parent and the server-rendered page would not hydrate. Enable them where the context allows:

```ts
import html, { BLOCK_ELEMENTS } from '@sveltekit-i18n/extension-html';

html({ onReport: null, components: BLOCK_ELEMENTS });
```

```svelte
<i18n.T key="terms" components={BLOCK_ELEMENTS} />
```

`BLOCK_ELEMENTS` maps `p`, `div`, `h1`–`h6`, `ul`, `ol`, `li`, `dl`, `dt`, `dd`, `blockquote`, `pre`, `hr`, `table`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td`, `caption`, `details` and `summary`.

A message is parsed with [`parse5`](https://github.com/inikulin/parse5), the HTML parser of the standard, as the content of a `<body>`: whatever it repairs — a link inside a link, a table row without its `<tbody>`, a paragraph a `<div>` closes, text inside a table — it repairs as a browser does, so the markup the server renders parses back into the same tree and hydrates.

The map can still break that tree: an element rendered as another, or one unmapped that kept its children apart — a `<table>` whose `<tbody>` the map leaves out, an `<h2>` inside an unmapped tag inside an `<h1>`. Before rendering, the markup the map makes of a message is parsed again, and a message that would not come back as the same tree renders as its text, and is reported. A component is checked as the tag it takes the place of — a `td: Cell` as a `<td>` — since its own markup is not known: a component that renders a block element where the message's tag was inline, or a link inside a link, is the app's to place. A message that nests elements more than 32 deep renders as its text too, since a render recurses per level; a component adds levels of its own, which the limit cannot count.

What the message cannot know is where it goes: a `<T>` inside an `<a>` renders the message's `<a>` inside it, which the browser splits apart. Pass `components={{ a: null }}` there.

### What never renders

No element that loads, runs or submits anything is in either set — no `img`, `script`, `style`, `iframe`, `form`, `input`, `object`, `base` or `meta` — and no layer can map a tag onto one unless the app names it. The content of `script`, `style`, `title`, `textarea`, `xmp`, `iframe`, `noembed`, `noframes`, `noscript`, `plaintext` and `template` is dropped with the element and reported, since it is not text of the message. Comments are dropped.

## Attributes

A translation may set only the attributes its tag allows, each with a quoted value (`href="/docs"`, not `href=/docs`: whitespace from the payload would end an unquoted value and start an attribute of its own); everything else — event handlers, `class`, `style`, `id` — is dropped and reported. The app sets those through an entry's `props`.

| Tag | Attributes |
|-----|------------|
| every tag | `title`, `lang`, `dir`, `translate` |
| `a` | `href`, `hreflang`, `target` |
| `ol` | `start`, `reversed`, `type` |
| `li` | `value` |
| `td`, `th` | `colspan`, `rowspan`, `headers`, `scope` |
| `details` | `open` |

`start`, `value`, `colspan` and `rowspan` take only an integer of at most nine digits, written as the DOM writes it back — no leading zeros, no `-0` — since Svelte sets `value` as a number. An `href` renders only with no scheme (`/docs`, `docs`, `#top`, `//example.com`) or with `http:`, `https:`, `mailto:` or `tel:`; any other — `javascript:`, `data:` — drops the attribute and is reported. A URL without a scheme is not necessarily on the same site: `//example.com` is not.

## Payloads

Interpolation brings no markup: every string in `params` is escaped before the parser sees it, and renders as the text it is. The values a message names — `name` in `{ name }` — have their `&`, `<`, `>`, `"` and `'` escaped, so a value the parser selects by (a `select` or `.match` key) with one of those characters no longer matches it. The keys, and the strings nested deeper, which a parser can only serialise, are also escaped for `=`, `/`, `` ` `` and whitespace, so a key with one of those no longer matches a placeholder that names it. Any other object — a `Date`, a class instance — reaches the parser as it is, for it to format, so an object whose `toString()` returns markup renders that markup: it is the app's own code. `args` are the parser's and are not escaped.

What the parser makes of an object is its own text: a parser that serialises an object into a quoted attribute can break the quoting. An element whose start tag the HTML parser reports an error in, as it does then, is rendered without any of its attributes, and each is reported. A copy the parser makes of an element — a link it reopens past a paragraph — has the attributes the element kept, and reports nothing again.

## Parsers

The parser runs first and `<T>` reads what it returns, so the parser has to pass markup through.

- [`parser-curly`](https://github.com/sveltekit-i18n/parsers/tree/master/parser-curly), [`parser-mf2`](https://github.com/sveltekit-i18n/parsers/tree/master/parser-mf2) and [`parser-i18next`](https://github.com/sveltekit-i18n/parsers/tree/master/parser-i18next) do. With i18next, keep its default `escapeValue: false`: the extension escapes the payload itself, and an escaped one would render its entities as text. Its unescape marker (`{{- name}}`) creates no markup in `<T>` either, since the payload is escaped before the parser sees it.
- [`parser-icu`](https://github.com/sveltekit-i18n/parsers/tree/master/parser-icu) reads tags as its own rich-text syntax and fails the message. Pass `ignoreTag: true`:

  ```ts
  import icu from '@sveltekit-i18n/parser-icu';

  const parser = icu({ onReport: null, ignoreTag: true });
  ```

## Reports

A report says what a message could not render, as the parsers' reports do:

```ts
type Report = {
  code: 'tag-unmapped' | 'tag-dropped' | 'attribute-dropped' | 'url-blocked' | 'nesting-invalid';
  key: string;
  locale: string;
  tag?: string;
  attribute?: string;
  message: string;
};
```

| Code | What happened |
|------|---------------|
| `tag-unmapped` | A tag no layer maps, or one of SVG or MathML: its content rendered without it. A tag the parser implied, such as a `<tbody>`, is not reported. |
| `tag-dropped` | A tag whose content is no text of the message, dropped with it. |
| `attribute-dropped` | An attribute its tag does not allow, a value it does not take or that is unquoted, or one of a start tag the parser reports an error in. |
| `url-blocked` | An `href` with a scheme that is not allowed. |
| `nesting-invalid` | The markup the map makes of the message would not parse back into the same tree, or it nests elements more than 32 deep: the message rendered as its text. It names no tag. |

A report is made each time the message renders — on the server and again in the browser, and on every change of a prop, the locale or the translations — so a channel that counts should deduplicate. A channel that throws does not stop the render.

## Other extensions

An extension whose output is no instance — such as [`extension-stores`](https://github.com/sveltekit-i18n/extensions/tree/master/extension-stores) — goes after this one, and `T` is then at `instance.T`:

```ts
export const { t, locale, instance: { T } } = new I18n({ ...config, extensions: [html({ onReport: null }), stores] });
```

Put the other way round, `html` throws at construction, and its output type carries no `T`. [`extension-typed-access`](https://github.com/sveltekit-i18n/extensions/tree/master/extension-typed-access) returns an output that is still an instance, so `html` may go after it and adds `T` beside the tree: `extensions: [typedAccess, html({ onReport: null })]`. `html` is a factory of the options: `extensions: [html]` and `html()` throw too.

## With SvelteKit

Put the extension in the config [`@sveltekit-i18n/base/kit`](https://github.com/sveltekit-i18n/base/blob/master/docs/README.md#sveltekit) wires, and `data.i18n`, `use()` and `get()` carry `T`. With `sveltekit-i18n` 3.1 or newer, import `defineI18n` from `sveltekit-i18n/kit` instead. The server renders the elements, and the browser hydrates them.

## Size

The markup is parsed with [`parse5`](https://github.com/inikulin/parse5), about 42 kB minified and gzipped with its entity tables — this package's one runtime dependency, and the price of a tree that matches the browser's. With the extension's own code, an app's client bundle grows by about 48 kB gzipped.

## Issues

This package is a part of the [sveltekit-i18n](https://github.com/sveltekit-i18n/lib) ecosystem. Please report issues [here](https://github.com/sveltekit-i18n/lib/issues).

## License

[MIT](https://github.com/sveltekit-i18n/extensions/blob/master/extension-html/LICENSE)
