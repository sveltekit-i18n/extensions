import type { Extension, I18n, Parser, Schema, Translations } from '@sveltekit-i18n/base';

type AnyI18n = I18n<any, any, any, any>;

/** An instance, or one a declaration file spells out structurally (the core's class is not exported), told by its `t`. */
type Spelled = AnyI18n | { t: Translations.TranslationFunction<any, any, any> };

/**
 * The names the root of `t` keeps for the function itself: every string name
 * a function answers, and `then`, which no level answers. The tree leaves them
 * out at the root; the string form still reaches a key under one of them.
 */
export const RESERVED = [
  '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__', '__proto__',
  'apply', 'arguments', 'bind', 'call', 'caller', 'constructor', 'hasOwnProperty', 'isPrototypeOf',
  'length', 'name', 'propertyIsEnumerable', 'then', 'toLocaleString', 'toString', 'valueOf',
] as const;

export type Reserved = typeof RESERVED[number];

type IsAny<T> = 0 extends 1 & T ? true : false;

/** Whether a key set has no literal member (`string`, `` `${number}` ``): what a key pattern leaves. */
type IsPattern<Keys extends string> = Record<never, never> extends Record<Keys, 1> ? true : false;

/**
 * The literal keys of a schema and its key patterns, apart. A union would lose
 * a literal to the pattern that matches it (`'cms.title' | `cms.${string}`` is
 * `` `cms.${string}` ``), and the literal's payload with it, so they are read
 * off the schema member by member.
 */
type Literals<S> = keyof { [K in keyof S as K extends string ? IsPattern<K> extends true ? never : K : never]: 1 } & string;
type Patterns<S> = keyof { [K in keyof S as K extends string ? IsPattern<K> extends true ? K : never : never]: 1 } & string;

/** The literal prefix of a pattern that is exactly `` `${prefix}.${string}` ``, the one shape the tree opens. */
type OpenPrefix<K extends string, Acc extends string = ''> = K extends `${infer H}.${infer R}`
  ? IsPattern<H> extends true ? never : string extends R ? `${Acc}${H}` : OpenPrefix<R, `${Acc}${H}.`>
  : never;

/** Each literal key's first segment, but an omitted one, mapped to what follows it in the keys under it. */
type Heads<Keys extends string, Omitted extends string> = {
  [K in Keys as Exclude<K extends `${infer H}.${string}` ? H : K, Omitted>]: K extends `${string}.${infer R}` ? R : never
};

/**
 * Below the root a reserved name is a node like any other, so the function
 * member TypeScript would read under it (`bind`, `call`, `length`, ...,
 * `prototype`) is typed as that node: `never`, or an open one, unless a schema
 * child of that name stands there.
 */
type Masked<Children extends PropertyKey, Node = never> = {
  readonly [K in Exclude<Reserved | 'prototype', 'then' | Children>]: Node
};

/**
 * TypeScript computes `keyof` of an object type anew, over every key, each
 * time it reads it, so a call never reads the schema's: each root computes
 * it once for the tree (`Keys`), and a leaf reads its payload off `Pick<S, K>`.
 */
type Leaf<S, P extends Parser.Params, O, K extends keyof S & string> =
  (...params: Schema.Params<Pick<S, K>, K, P>) => Translations.Translated<O>;

/** `then` is optional, so an open node is no thenable to `Awaited`. */
type Opened<O> = { readonly [segment: string]: Open<O> } & { readonly then?: never };

interface Segments<O> extends Masked<never, Open<O>> {
  (...params: any[]): Translations.Translated<O>;
  readonly [segment: string]: Open<O>;
}

/** What a node every path below which is a key leaves open: any segment, any payload. */
export type Open<O = string> = Segments<O> & { readonly then?: never };

/** A level: each head of the literal keys and open prefixes, indexed (`M` is their `Heads`). */
type Level<S, P extends Parser.Params, O, M, Pats extends string, Prefix extends string, Keys extends keyof S> = {
  readonly [H in keyof M]: Node<S, P, O, `${Prefix}${H & string}`, M[H] & string, Pats, Keys>
};

/** An open node where an open prefix covers every path below `Path`, else `never`. */
type Below<O, Path extends string, Pats extends string> =
  [Pats] extends [never] ? never : `${Path}.${string}` extends Pats ? Open<O> : never;

/**
 * A node is a leaf where its path is a key, open where an open prefix covers
 * every path below it, and a level over the keys below it.
 */
type Node<S, P extends Parser.Params, O, Path extends string, Lits extends string, Pats extends string,
  Keys extends keyof S, B = Below<O, Path, Pats>> =
  (Path extends Keys ? Leaf<S, P, O, Path> : unknown)
  & ([B] extends [never] ? unknown : Opened<O>)
  & ([Lits] extends [never] ? Masked<never, B>
    : Level<S, P, O, Heads<Lits, 'then'>, Pats, `${Path}.`, Keys> & Masked<keyof Heads<Lits, 'then'>, B>);

/**
 * The root reserves no `prototype` (the runtime answers a node there), so the
 * `Function` member TypeScript reads under it is masked like the ones below.
 */
type Prototype<Segments extends PropertyKey> = 'prototype' extends Segments ? unknown : { readonly prototype: never };

type Root<S, P extends Parser.Params, O, Lits extends string, Pats extends string, Keys extends keyof S = keyof S> =
  Level<S, P, O, Heads<Lits, Reserved>, Pats, '', Keys> & Prototype<keyof Heads<Lits, Reserved>>;

/**
 * The levels `@sveltekit-i18n/typegen` registers, where they were built from
 * exactly the schema's literal keys and patterns: a key declared beside the
 * generated ones, or a schema of other keys, falls back to grouping the keys
 * here.
 */
type Generated<S> = SvelteKitI18n.Register extends { tree: { keys: infer K; patterns: infer Q; next: infer N } }
  ? Built<S, K, Q> extends true ? N : never
  : never;

/**
 * Whether a schema's keys are the literals `K` and the patterns `Q`. Without
 * patterns `keyof S` is its literals; a pattern absorbs the literals it
 * matches, so only then are they read off the schema member by member.
 * Literals compare by assignability both ways, exact for them and fast on a
 * large key set, where identity is not.
 */
type Built<S, K, Q> = [Q] extends [never] ? SameKeys<keyof S, K>
  : SameKeys<Literals<S>, K> extends true ? Same<Patterns<S>, Q> : false;

type SameKeys<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;

/** A generated level: each segment of `Next` but an omitted one. */
type GeneratedLevel<S, P extends Parser.Params, O, Next, Omitted extends PropertyKey, B, Keys extends keyof S> = {
  readonly [H in Exclude<keyof Next, Omitted>]: GeneratedNode<S, P, O, Next[H], B, Keys>
};

/**
 * A generated node: a leaf where it names a key, open where it or a node above
 * it is an open namespace (`B`), and a level over the segments below it.
 */
type GeneratedNode<S, P extends Parser.Params, O, N, Up, Keys extends keyof S, B = N extends { open: true } ? Open<O> : Up> =
  (N extends { key: infer K extends Keys & string } ? Leaf<S, P, O, K> : unknown)
  & ([B] extends [never] ? unknown : Opened<O>)
  & (N extends { next: infer Next }
    ? GeneratedLevel<S, P, O, Next, 'then', B, Keys> & Masked<Exclude<keyof Next, 'then'>, B>
    : Masked<never, B>);

type GeneratedRoot<S, P extends Parser.Params, O, Next, Keys extends keyof S = keyof S> =
  GeneratedLevel<S, P, O, Next, Reserved, never, Keys> & Prototype<Exclude<keyof Next, Reserved>>;

type Build<S, P extends Parser.Params, O, Next = Generated<S>> = IsAny<S> extends true ? unknown
  : [S] extends [never] ? unknown
    : [Next] extends [never] ? Root<S, P, O, Literals<S> | OpenPrefix<Patterns<S>>, `${OpenPrefix<Patterns<S>>}.${string}`>
      : GeneratedRoot<S, P, O, Next>;

/**
 * The member tree over an instance's `schema`; nothing without a closed one.
 * An instance a declaration file spells out structurally (the core's class is
 * not exported) is read through its `t`.
 */
export type Tree<I> = I extends I18n<infer P, infer O, infer S, any> ? Build<S, P, O>
  : I extends { t: Translations.TranslationFunction<infer P, infer O, infer S> } ? Build<S, P, O>
    : unknown;

/**
 * The core members of the instance, as it types them (a patched `loadConfig`
 * included), and not what an extension before this one added: the output
 * forwards the core's members only. An instance a declaration file spells out
 * keeps the private brand it spells for the class, so the output still fits
 * where that type is asked for. `keyof` is spelled out: a library's
 * declarations cannot name a local alias.
 */
type Core<I> = IsAny<I> extends true ? AnyI18n
  : I extends I18n<infer P, infer O, infer S, infer L> ? Pick<I, keyof I18n<any, any, any, any>> & I18n<P, O, S, L>
    : Pick<I, Extract<keyof I, keyof I18n<any, any, any, any> | `__#${string}`>>;

type Same<A, B> = (<X>() => X extends A ? 1 : 2) extends (<X>() => X extends B ? 1 : 2) ? true : false;

/**
 * How many outputs of this extension lie under `I`, as nested tuples: `[]`
 * for none. A library's declarations spell the mark with `undefined`, which
 * `exactOptionalPropertyTypes` keeps.
 */
type Depth<I> = '~typedAccess' extends keyof I
  ? NonNullable<I extends { readonly '~typedAccess'?: infer D } ? D : never>
  : [];

/**
 * An output of this extension, which it hands back as is: its mark lies one
 * level deeper than its `instance`'s. One another extension added members to
 * in place keeps both; another extension's surface over an output keeps the
 * mark but exposes the output as its `instance`, whose mark lies as deep.
 */
type Applied<I> = I extends { instance: infer K } ? Same<Depth<I>, [Depth<K>]> : false;

/**
 * The output over an instance. Exported so that a library's declarations name
 * it instead of spelling the tree out, which a generic schema cannot be and a
 * large one outgrows.
 */
export type Wrapped<I extends { t: unknown }> = Core<I> & {
  t: I['t'] & Tree<I>;
  instance: I;
  /**
   * Type-only, and never present at runtime: the depth, not the instance,
   * which declarations would spell out once more. Spelled with `undefined`,
   * as declarations spell it, so a named output and one spelled out match.
   */
  readonly '~typedAccess'?: [Depth<I>] | undefined;
};

/**
 * The core instance under the name base exports, and any other input as is:
 * declarations would spell the unexported class out and lose its brand. Only
 * the same type is renamed, so no optional member an extension added is lost.
 */
type Named<I> = I extends I18n<infer P, infer O, infer S, infer L> ? Same<I, I18n<P, O, S, L>> extends true ? I18n<P, O, S, L> : I : I;

export type Output<I extends { t: unknown } = AnyI18n> = IsAny<I> extends true ? Wrapped<I>
  : Applied<I> extends true ? I : Wrapped<Named<I>>;

/**
 * The output is derived from the instance the pipe hands over and stays an
 * instance type, so `schema` and the locale union survive, and an
 * `Extension.Operator` after this one still reads them.
 */
export interface WithTypedAccess extends Extension.Operator {
  readonly output: Output<Extract<this['input'], AnyI18n>>;
}

type T = (key: string, ...params: unknown[]) => unknown;

const reserved: ReadonlySet<PropertyKey> = new Set(RESERVED);

// Nothing is written through the tree: the root's target is the instance's own `t`.
const readOnly = {
  defineProperty: () => false,
  deleteProperty: () => false,
  preventExtensions: () => false,
  setPrototypeOf: () => false,
};

const node = (t: T, path: string): T => new Proxy<T>(() => undefined, {
  ...readOnly,
  get: (_, key) => (typeof key === 'symbol' || key === 'then' ? undefined : node(t, `${path}.${key}`)),
  apply: (_, __, params: unknown[]) => t(path, ...params),
});

const root = (t: T): T => new Proxy(t, {
  ...readOnly,
  get: (target, key) => {
    if (typeof key === 'symbol' || key === 'then') return undefined;

    return reserved.has(key) ? Reflect.get(target, key) : node(target, key);
  },
});

const cache = new WeakMap<object, Output>();

const typedAccess = <I extends Spelled>(input: I): Output<I> => {
  const i18n = input as AnyI18n;
  const memoized = cache.get(i18n);

  if (memoized) return memoized as Output<I>;

  if (typeof i18n?.t !== 'function') {
    throw new Error('[i18n]: `typedAccess` takes an instance. Place it before any extension that replaces the instance, such as `stores`.');
  }

  // The root follows the identity of the instance's `t`.
  let current: [T, T] | undefined;

  const output = {
    get t() {
      const t = i18n.t as T;

      if (current?.[0] !== t) current = [t, root(t)];

      return current[1];
    },
    get l() { return i18n.l; },
    get locale() { return i18n.locale; },
    set locale(locale) {
      // Assignment is the instance's fire-and-forget `setLocale()`.
      i18n.locale = locale;
    },
    get locales() { return i18n.locales; },
    get loading() { return i18n.loading; },
    get initialized() { return i18n.initialized; },
    get translations() { return i18n.translations; },
    get rawTranslations() { return i18n.rawTranslations; },
    loadTranslations: i18n.loadTranslations,
    preload: i18n.preload,
    loadNamespace: i18n.loadNamespace,
    setLocale: i18n.setLocale,
    setRoute: i18n.setRoute,
    loadConfig: i18n.loadConfig,
    addTranslations: i18n.addTranslations,
    invalidate: i18n.invalidate,
    snapshot: i18n.snapshot,
    hydrate: i18n.hydrate,
    destroy: i18n.destroy,
    instance: i18n,
  } as unknown as Output;

  cache.set(i18n, output);
  cache.set(output, output);

  return output as Output<I>;
};

// The brand alone: `Extension.Generic` would add a call signature that takes anything.
export default typedAccess as typeof typedAccess & Pick<Extension.Generic<WithTypedAccess>, keyof Extension.Generic<WithTypedAccess>>;
