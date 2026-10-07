import I18n from '@sveltekit-i18n/base';
import type { Config, Extension, I18n as I18nType, Parser, Schema, Translations } from '@sveltekit-i18n/base';
import { defineI18n } from '@sveltekit-i18n/base/kit';
import stores from '@sveltekit-i18n/extension-stores';
import { expectTypeOf, it } from 'vitest';

import typedAccess from '../../src';
import type { Output, Reserved, Tree } from '../../src';

// Asserted by compiling: `pretest` runs `tsc`, so an unused `@ts-expect-error` fails the run.
// The closures are never invoked.

type S = {
  'common.hi': { name: string };
  'common.bye': never;
  'common.opt': { count?: number };
  'common.maybe': { a: string } | undefined;
  'nav.home': any;
  'a': never;
  'a.b': { x: number };
  'list.0': never;
  'odd key': never;
  'form.name': never;
  'form.length': never;
  'form.then': never;
  'name.first': never;
  'then.x': never;
  'deep.a.b.c.d': { d: 1 };
  [key: `cms.${string}`]: any;
  'cms.title': { x: string };
  [key: `row.${number}`]: { n: number };
  'mixed.title': { m: 1 };
  [key: `mixed.${number}`]: never;
};

type Params = [Record<string, unknown>?, { formats?: 1 }?];

const parser: Parser.T<Params> = { parse: (value: any) => value };
const config = { parser, initLocale: 'en', fallbackLocale: 'cs', schema: {} as S, extensions: [typedAccess] } as const;
const out = new I18n(config);

type Instance = I18nType<Params, string, S, 'en' | 'cs'>;

it('types each leaf by the payload rules of the string form', () => () => {
  out.t.common.hi({ name: 'x' });
  out.t.common.hi({ name: 'x' }, { formats: 1 });
  // @ts-expect-error a required payload
  out.t.common.hi();
  // @ts-expect-error a payload of another shape
  out.t.common.hi({ nope: 1 });
  out.t.common.bye();
  out.t.common.bye(undefined);
  // @ts-expect-error a message without params takes no payload
  out.t.common.bye({ a: 1 });
  out.t.common.opt();
  out.t.common.opt({ count: 1 });
  out.t.common.maybe();
  out.t.common.maybe({ a: 'x' });
  out.t.nav.home({ anything: 1 });
  out.t.nav.home();
  out.t.deep.a.b.c.d({ d: 1 });
  expectTypeOf(out.t.common.hi).parameters.toEqualTypeOf<Schema.Params<S, 'common.hi', Params>>();
  expectTypeOf(out.t.common.hi).returns.toEqualTypeOf<Translations.Translated<string>>();
});

it('types a key that is also a prefix, a numeric segment and a non-identifier', () => () => {
  out.t.a();
  out.t.a.b({ x: 1 });
  // @ts-expect-error a required payload
  out.t.a.b();
  out.t.list[0]();
  out.t['odd key']();
});

it('closes the key set', () => () => {
  // @ts-expect-error an unknown namespace
  out.t.nope();
  // @ts-expect-error an unknown key
  out.t.common.nope();
  // @ts-expect-error a namespace is not a key
  out.t.common();
  out.t('common.hi', { name: 'x' });
  // @ts-expect-error the string form stays typed
  out.t('common.hi');
  // @ts-expect-error the string form stays closed
  out.t('common.nope');
});

it('leaves the reserved names out at the root and then out everywhere', () => () => {
  expectTypeOf(out.t.name).toEqualTypeOf<string>();
  expectTypeOf(out.t.length).toEqualTypeOf<number>();
  // @ts-expect-error a reserved name reads the real t
  out.t.name.first();
  // @ts-expect-error then is never a node
  out.t.then.x();
  out.t.form.name();
  out.t.form.length();
  // @ts-expect-error then is never a node
  out.t.form.then();
  out.t('name.first');
  expectTypeOf<Reserved>().toEqualTypeOf<
    | '__defineGetter__' | '__defineSetter__' | '__lookupGetter__' | '__lookupSetter__' | '__proto__'
    | 'apply' | 'arguments' | 'bind' | 'call' | 'caller' | 'constructor' | 'hasOwnProperty' | 'isPrototypeOf'
    | 'length' | 'name' | 'propertyIsEnumerable' | 'then' | 'toLocaleString' | 'toString' | 'valueOf'
  >();
});

it('opens a node every path below which is a key', () => () => {
  out.t.cms.anything.at.all({ x: 1 });
  out.t.cms.x();
  // @ts-expect-error 'cms' itself is not a key
  out.t.cms();
  out.t.mixed.title({ m: 1 });
  // @ts-expect-error a literal beside a pattern keeps its payload
  out.t.mixed.title();
});

it('keeps the payload of a literal key beside a pattern of its namespace', () => () => {
  out.t.cms.title({ x: 'y' });
  // @ts-expect-error a required payload
  out.t.cms.title();
  // @ts-expect-error a payload of another shape
  out.t.cms.title({ y: 1 });
  // @ts-expect-error the string form agrees
  out.t('cms.title');
  out.t.cms.other();
});

it('opens each path below a literal key that a prefix pattern matches', () => () => {
  type Deep = { 'a.b.c': never; [key: `a.${string}`]: any; 'x.y.z': never; [key: `x.${string}`]: { p: 1 } };
  const deep = new I18n({ parser, schema: {} as Deep, extensions: [typedAccess] });

  out.t('cms.title.sub');
  out.t.cms.title.sub();
  out.t.cms.title.sub.deep({ q: 1 });
  deep.t('a.b.x');
  deep.t.a.b.x();
  deep.t.a.b.c();
  // A path a pattern matches is a leaf with the pattern's payload.
  deep.t.x.y({ p: 1 });
  // @ts-expect-error the string form agrees
  deep.t.x.y();
  deep.t.x.y.z();
});

it('opens a namespace typegen leaves open, dotted too, beside the keys it read', () => () => {
  type Generated = {
    'product.cta': never;
    [key: `product.${string}`]: any;
    [key: `article.${string}`]: any;
    [key: `blog.post.${string}`]: any;
    'cms.title': { x: string };
    [key: `cms.${string}.label`]: any;
    [key: `cms.title.name.${string}`]: { n: 1 };
  };
  const generated = new I18n({ parser, schema: {} as Generated, extensions: [typedAccess] });

  generated.t.article.title();
  generated.t.article.meta.author({ any: 1 });
  generated.t.product.cta();
  generated.t.product.description();
  generated.t.blog.post.title();
  generated.t.cms.title({ x: 'y' });
  generated.t.cms.title.name.first({ n: 1 });
  // @ts-expect-error 'article' itself is not a key
  generated.t.article();
  // @ts-expect-error 'blog.other' is no key
  generated.t.blog.other();
});

it('leaves any other key pattern to the string form', () => () => {
  type Other = {
    'home.title': never;
    [key: `${string}.suffix`]: { s: 1 };
    [key: `x${number}.y`]: never;
    [key: `z${number}.${string}`]: any;
  };
  const other = new I18n({ parser, schema: {} as Other, extensions: [typedAccess] });
  type Generated = { 'cms.title': never; [key: `cms.${string}.label`]: any };
  const generated = new I18n({ parser, schema: {} as Generated, extensions: [typedAccess] });

  out.t('row.3', { n: 1 });
  // @ts-expect-error a pattern that opens no node
  out.t.row[3]({ n: 1 });
  out.t('mixed.0');
  // @ts-expect-error a pattern that opens no node
  out.t.mixed[0]();
  // @ts-expect-error nor does it open a literal key beside it
  out.t.mixed.title.x();
  other.t('home.suffix', { s: 1 });
  // @ts-expect-error a pattern spanning segments opens no node
  other.t.home.suffix({ s: 1 });
  other.t.home.title();
  // @ts-expect-error the string form agrees
  other.t('home.nope');
  // @ts-expect-error nor does the tree open it
  other.t.home.nope();
  generated.t('cms.other.label');
  // @ts-expect-error a pattern whose tail is literal opens no node
  generated.t.cms.other.label();
  other.t('z1.a');
  // @ts-expect-error nor does one whose prefix is a pattern
  other.t.z1.a();

  type Covering = { 'home.title': { p: 1 }; [key: `${string}.${string}`]: any; 'ab.c': never; [key: `a${string}`]: { p: 1 } };
  const covering = new I18n({ parser, schema: {} as Covering, extensions: [typedAccess] });

  covering.t('home.other');
  // @ts-expect-error nor a literal key a pattern covers
  covering.t.home.other();
  covering.t('ab.z', { p: 1 });
  // @ts-expect-error nor a literal key a pattern covers
  covering.t.ab.z();
});

it('pins what a key pattern leaves open, below its first level too', () => () => {
  expectTypeOf(out.t.cms.page()).toEqualTypeOf<Translations.Translated<string>>();
  expectTypeOf(out.t.cms.page.x()).toEqualTypeOf<Translations.Translated<string>>();
  // A function member is a segment, however deep: `t('cms.page.x.name')`.
  expectTypeOf(out.t.cms.page.x.name()).toEqualTypeOf<Translations.Translated<string>>();
  out.t.cms.name({ any: 1 });
  out.t.cms.title.length();
  out.t.cms.prototype.x();
  out.t.cms.a.b.bind.c();
});

it('keeps the parser output', () => () => {
  const numeric = new I18n({ parser: {} as Parser.T<Params, number>, schema: {} as S, extensions: [typedAccess] });

  expectTypeOf(numeric.t.common.hi).returns.toEqualTypeOf<number | string>();
});

it('adds nothing without a closed schema', () => () => {
  const plain = new I18n({ parser, extensions: [typedAccess] });
  const unclosed: Record<string, never> = {};
  const open = new I18n({ parser, schema: unclosed, extensions: [typedAccess] });
  const opted = new I18n({ parser, schema: {}, extensions: [typedAccess] });

  expectTypeOf<Tree<typeof plain.instance>>().toEqualTypeOf<unknown>();
  expectTypeOf(plain.t).toEqualTypeOf(plain.instance.t);
  expectTypeOf(open.t).toEqualTypeOf(open.instance.t);
  expectTypeOf(opted.t).toEqualTypeOf(opted.instance.t);
  expectTypeOf<Tree<I18nType<any, any, any, any>>>().toEqualTypeOf<unknown>();
  plain.t('anything');
  // @ts-expect-error no tree without a schema
  plain.t.anything();
});

it('stays the instance it wraps', () => () => {
  expectTypeOf<Schema.FromInstance<typeof out>>().toEqualTypeOf<S>();
  expectTypeOf(out.instance).toEqualTypeOf<Instance>();
  expectTypeOf(out).toExtend<Instance>();
  expectTypeOf(out).toExtend<I18nType<any, any, any, any>>();
  expectTypeOf(out.locale).toEqualTypeOf<'en' | 'cs' | (string & {}) | undefined>();
  out.locale = 'cs';
  void out.setLocale('cs');
  // Known gap: an intersection cannot make a member readonly, and these throw.
  out.loading = true;
});

it('mirrors the instance surface member for member', () => {
  expectTypeOf<Exclude<keyof I18nType, keyof Output>>().toEqualTypeOf<never>();
  expectTypeOf<Exclude<keyof Output, keyof I18nType>>().toEqualTypeOf<'instance' | '~typedAccess'>();
});

it('reads no schema back off t, which is why it keeps the instance', () => {
  type Read<F> = F extends Translations.TranslationFunction<any, any, infer K> ? K : 'no match';

  expectTypeOf<Read<typeof out.instance.t>>().toEqualTypeOf<S>();
  expectTypeOf<Read<typeof out.t>>().toEqualTypeOf<unknown>();
});

it('is idempotent', () => () => {
  const direct = typedAccess(new I18n({ parser, schema: {} as S }));
  const twice = typedAccess(direct);
  const piped = new I18n({ ...config, extensions: [typedAccess, typedAccess] });

  direct.t.common.hi({ name: 'y' });
  twice.t.common.hi({ name: 'y' });
  piped.t.common.hi({ name: 'y' });
  // @ts-expect-error the key set stays closed
  twice.t.common.hi();
  expectTypeOf<Schema.FromInstance<typeof twice>>().toEqualTypeOf<S>();
  expectTypeOf(twice).toEqualTypeOf(direct);
  expectTypeOf(piped).toEqualTypeOf(out);
  // @ts-expect-error `instance` is the core, whose t has no tree
  piped.instance.t.common.hi({ name: 'y' });
  // @ts-expect-error the core has no `instance`
  void piped.instance.instance;

  const prototyped = new I18n({ parser, schema: {} as { 'prototype.x': never }, extensions: [typedAccess] });

  expectTypeOf(typedAccess(prototyped)).toEqualTypeOf(prototyped);
});

it('takes an instance a declaration file spells out structurally', () => () => {
  type Spelled = { '__#private@#private': any; locale: string; t: Translations.TranslationFunction<Params, string, S> };
  const spelled = typedAccess({} as Spelled);

  spelled.t.common.hi({ name: 'x' });
  // @ts-expect-error the key set stays closed
  spelled.t.common.nope();
  // It still fits where the library asks for its instance.
  const back: Spelled = spelled;
  // @ts-expect-error the output forwards the core's members only
  void typedAccess({} as Spelled & { extra: number }).extra;

  // A library's own output of the extension, whose `instance` and mark it spells out.
  type Emitted = Instance & { t: Instance['t'] & Tree<Instance>; instance: Spelled; readonly '~typedAccess'?: [[]] | undefined };
  const again = typedAccess({} as Emitted);

  expectTypeOf(again).toEqualTypeOf<Emitted>();
  // @ts-expect-error `instance` is the core
  void again.instance.instance;
  void back;

  type Plain = { '__#private@#private': any; locale: string; t: Translations.TranslationFunction<Params, string, never> };
  const once = typedAccess({} as Plain);

  expectTypeOf(typedAccess(once)).toEqualTypeOf(once);
});

it('wraps what another extension exposing instance hands over', () => () => {
  type Replaced<I> = Extract<I, I18nType<any, any, any, any>> & { instance: Extract<I, I18nType<any, any, any, any>> };
  interface Forward extends Extension.Operator {
    readonly output: Replaced<this['input']>;
  }
  interface Logged extends Extension.Operator {
    readonly output: Replaced<this['input']> & { log: () => void };
  }
  const forward = ((i18n: any) => i18n) as Extension.Generic<Forward>;
  const logged = ((i18n: any) => i18n) as Extension.Generic<Logged>;
  const forwarded = new I18n({ ...config, extensions: [forward, typedAccess] });
  const before = new I18n({ ...config, extensions: [logged, typedAccess] });
  const between = new I18n({ ...config, extensions: [typedAccess, logged, typedAccess] });

  forwarded.t.common.hi({ name: 'x' });
  before.t.common.hi({ name: 'x' });
  between.t.common.hi({ name: 'x' });
  // @ts-expect-error the output forwards the core's members only
  before.log();
  // @ts-expect-error the output forwards the core's members only
  between.log();

  const again = typedAccess(forwarded);

  expectTypeOf(again).toEqualTypeOf(forwarded);
  expectTypeOf(new I18n({ ...config, extensions: [forward, typedAccess, typedAccess] })).toEqualTypeOf(forwarded);
  // @ts-expect-error the forwarding surface's t carries no tree
  again.instance.t.common.hi({ name: 'x' });
  expectTypeOf(typedAccess(between)).toEqualTypeOf(between);

  const layers = new I18n({ ...config, extensions: [typedAccess, logged, typedAccess, logged, typedAccess] });

  expectTypeOf(typedAccess(layers)).toEqualTypeOf(layers);
  layers.instance.log();
  layers.instance.instance.instance.log();
  layers.instance.instance.instance.instance.t.common.hi({ name: 'x' });

  // The core's t reads a `prototype` as `any`, so a tree of that key alone fits it.
  const proto = { parser, schema: {} as { 'prototype.x': never } };
  const loggedProto = new I18n({ ...proto, extensions: [logged, typedAccess] });
  const forwardedProto = new I18n({ ...proto, extensions: [forward, typedAccess] });

  loggedProto.t.prototype.x();
  loggedProto.instance.log();
  // @ts-expect-error the output forwards the core's members only
  loggedProto.log();
  expectTypeOf(forwardedProto.instance.instance).toExtend<I18nType>();
  expectTypeOf(typedAccess(forwardedProto)).toEqualTypeOf(forwardedProto);

  // Without a mark, an `instance` of any type is another extension's.
  typedAccess({} as Instance & { instance: unknown }).t.common.hi({ name: 'x' });

  const loose = {} as typeof out & { instance: any; log: () => void };

  // @ts-expect-error the output forwards the core's members only
  typedAccess(loose).log();

  // Known gaps: the mark tells how many outputs lie under a type, not which.
  // A surface that types its `instance` as loosely as a plain instance reads as
  // the output it spreads, and a type without the mark as an instance.
  const plainInstance = {} as typeof out & { instance: I18nType<any, any, any, any>; log: () => void };
  const picked = {} as Pick<typeof out, 't' | 'locale' | 'instance'>;

  expectTypeOf(typedAccess(plainInstance)).toEqualTypeOf(plainInstance);
  expectTypeOf(typedAccess(picked).instance).toEqualTypeOf(picked);
});

it('rejects a direct call on what is no instance', () => () => {
  // @ts-expect-error the stores surface is no instance
  typedAccess(stores(new I18n({ parser })));
  // @ts-expect-error nor is an object
  typedAccess({});
});

it('composes with extension-stores after it, and only after it', () => () => {
  const both = new I18n({ ...config, extensions: [typedAccess, stores] });

  expectTypeOf<Schema.FromInstance<typeof both.instance>>().toEqualTypeOf<S>();
  both.t.get().common.hi({ name: 'x' });
  both.t.get()('common.hi', { name: 'x' });
  // @ts-expect-error the key set stays closed
  both.t.get()('common.nope');
  // @ts-expect-error the key set stays closed
  both.t.get().common.nope();
  both.instance.instance.t('common.bye');
  expectTypeOf(both.locale.get()).toEqualTypeOf<'en' | 'cs' | (string & {}) | undefined>();
  expectTypeOf(both.preload).toBeFunction();

  const wrong = new I18n({ ...config, extensions: [stores, typedAccess] });

  expectTypeOf(wrong).toEqualTypeOf<never>();
});

it('keeps a method an extension before it retyped, and drops a member it added', () => () => {
  interface Patch extends Extension.Operator {
    readonly output: Extract<this['input'], I18nType<any, any, any, any>> & { loadConfig: (config: { parserOptions: 1 }) => Promise<void> };
  }
  interface Add extends Extension.Operator {
    readonly output: Extract<this['input'], I18nType<any, any, any, any>> & { extra: number };
  }
  const patch = ((i18n: any) => i18n) as Extension.Generic<Patch>;
  const add = ((i18n: any) => i18n) as Extension.Generic<Add>;
  const lib = new I18n({ ...config, extensions: [patch, typedAccess] });
  const after = new I18n({ ...config, extensions: [typedAccess, add] });
  const before = new I18n({ ...config, extensions: [add, typedAccess] });

  void lib.loadConfig({ parserOptions: 1 });
  void lib.instance.loadConfig({ parserOptions: 1 });
  lib.t.common.hi({ name: 'x' });
  expectTypeOf<Schema.FromInstance<typeof lib>>().toEqualTypeOf<S>();
  expectTypeOf(after.extra).toEqualTypeOf<number>();
  after.t.common.hi({ name: 'x' });
  expectTypeOf(before.instance.extra).toEqualTypeOf<number>();
  // @ts-expect-error the output forwards the core's members only
  void before.extra;
});

it('hands back an output another extension added a member to in place', () => () => {
  interface Add extends Extension.Operator {
    readonly output: Extract<this['input'], I18nType<any, any, any, any>> & { extra: number };
  }
  const add = ((i18n: any) => i18n) as Extension.Generic<Add>;
  const between = new I18n({ ...config, extensions: [typedAccess, add, typedAccess] });
  const plain = new I18n({ parser, extensions: [typedAccess, add, typedAccess] });

  expectTypeOf(between.extra).toEqualTypeOf<number>();
  between.t.common.hi({ name: 'x' });
  expectTypeOf(between.instance).toEqualTypeOf<Instance>();
  // @ts-expect-error `instance` is the core
  void between.instance.instance;
  expectTypeOf(plain.extra).toEqualTypeOf<number>();
  // @ts-expect-error `instance` is the core
  void plain.instance.instance;
});

it('types a config held in a variable only as const', () => () => {
  const held: Config.T<Params> = { parser, schema: {} as S, extensions: [typedAccess] };
  const widened = new I18n(held);

  widened.t('anything');
});

it('carries the tree through /kit', () => () => {
  const kit = defineI18n({ ...config, loaders: [] });
  const i18n = kit.get();

  i18n.t.common.hi({ name: 'x' });
  // @ts-expect-error the key set stays closed
  i18n.t.common.nope();

  const both = defineI18n({ ...config, loaders: [], extensions: [typedAccess, stores] }).use(() => ({}));

  both.t.get().common.hi({ name: 'x' });
});

it('settles an awaited node to itself', () => {
  expectTypeOf<Awaited<typeof out.t.common>>().toEqualTypeOf(out.t.common);
  expectTypeOf<Awaited<typeof out.t.cms>>().toEqualTypeOf(out.t.cms);
  expectTypeOf<Awaited<typeof out.t.cms.page>>().toEqualTypeOf(out.t.cms.page);
  expectTypeOf<Awaited<typeof out.t.common.hi>>().toEqualTypeOf(out.t.common.hi);
});

it('offers no function member below the root, where the runtime answers a node', () => () => {
  // @ts-expect-error a leaf's bind is a node
  out.t.common.bye.bind(null);
  // @ts-expect-error a leaf's call is a node
  out.t.common.hi.call(null, { name: 'x' });
  // @ts-expect-error a leaf's apply is a node
  out.t.common.hi.apply(null, [{ name: 'x' }]);
  // @ts-expect-error a namespace's toString is a node
  out.t.common.toString();
  // @ts-expect-error a namespace's valueOf is a node
  out.t.common.valueOf();
  // @ts-expect-error then is never a node, under a key pattern either
  out.t.cms.page.then();
  // @ts-expect-error then is never a node, directly under a key pattern either
  out.t.cms.then();
  expectTypeOf(out.t.common.bye.length).toBeNever();
  expectTypeOf(out.t.common.bye.prototype).toBeNever();
  expectTypeOf(out.t.prototype).toBeNever();
  // @ts-expect-error the string form agrees
  out.t('prototype.x');
  const named = new I18n({ parser, schema: {} as { 'prototype.x': never }, extensions: [typedAccess] });
  const open = new I18n({ parser, schema: {} as { 'a': never; [key: `prototype.${string}`]: any }, extensions: [typedAccess] });

  named.t.prototype.x();
  open.t.prototype.anything();
  // A schema child of the name stays the child.
  out.t.form.name();
  out.t.form.length();
  out.t.cms.page.title();
  out.t('form.name');
});

it('reads the tree off t when a declaration file spells the instance out structurally', () => {
  type Spelled = { '__#private@#private': any; locale: string; t: Translations.TranslationFunction<Params, string, S> };

  expectTypeOf<Tree<Spelled>>().toEqualTypeOf<Tree<Instance>>();
  expectTypeOf<Output<Spelled>['t']['common']['hi']>().toEqualTypeOf<Output<Instance>['t']['common']['hi']>();
  expectTypeOf<Output<Spelled>['locale']>().toEqualTypeOf<string>();
});

it('keeps the core surface after an untyped extension', () => () => {
  const untyped = ((i18n: any) => i18n) as Extension.T<any, any>;
  const after = new I18n({ ...config, extensions: [untyped, typedAccess] });

  void after.setLocale('cs');
  // @ts-expect-error the output forwards the core's members only
  void after.extra;
});
