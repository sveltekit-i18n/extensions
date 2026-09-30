import type { Config, Extension, I18n, Schema } from '@sveltekit-i18n/base';
import type { Component } from 'svelte';

type AnyI18n = I18n<any, any, any, any>;

/**
 * What a tag of a translation renders as: a native element by name (`'strong'`
 * for `<b>`), a component, either of them with props of the app's own, or
 * `null`, which unmaps a tag a lower layer maps.
 */
export type Entry = string | Component<any> | { component: string | Component<any>; props?: Record<string, unknown> } | null;

/** Entries by the tag a translation names, lower-case. */
export type Components = Record<string, Entry>;

export type Report = {
  code: 'tag-unmapped' | 'tag-dropped' | 'attribute-dropped' | 'url-blocked' | 'nesting-invalid';
  key: string;
  locale: string;
  /** The tag as the translation names it; absent for `nesting-invalid`. */
  tag?: string;
  /** The attribute dropped, for `attribute-dropped` and `url-blocked`. */
  attribute?: string;
  message: string;
};

export type Options = {
  /** Where the reports go; `null` discards them. */
  onReport: ((report: Report) => void) | null;
  /** The app's layer of the component map, over the defaults. */
  components?: Components;
};

type IsAny<T> = 0 extends 1 & T ? true : false;

type Args<T extends unknown[]> = [] extends T ? { args?: T | undefined } : { args: T };

/** A key's rest params as props: the payload as `params`, the rest as `args`. */
type Split<R extends unknown[]> = IsAny<R> extends true
  ? { params?: any; args?: any[] | undefined }
  : R extends [unknown, ...unknown[]]
    ? R extends [infer V, ...infer T] ? { params: V } & Args<T> : never
    : R extends [(infer V)?, ...infer T] ? { params?: V | undefined } & Args<T> : { params?: undefined };

type Common<L extends string> = {
  /** Renders in this locale rather than the active one, as `l()` does. */
  locale?: Config.LocaleInput<L> | undefined;
  /** The usage's layer of the component map, over the config's. */
  components?: Components | undefined;
};

/** The keys a message renders for with no params at all. */
type Bare<S, P extends unknown[]> = {
  [K in Schema.Key<S>]: [] extends Schema.Params<S, K, P> ? K : never
}[Schema.Key<S>];

type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

/** The keys that take exactly the params of a key without a payload. */
type Plain<S, P extends unknown[]> = {
  [K in Schema.Key<S>]: Same<Schema.Params<S, K, P>, Schema.Params<S, never, P>> extends true ? K : never
}[Schema.Key<S>];

type Flat<T> = { [K in keyof T]: T[K] };

/** A member for the keys `K`, or none without keys: a `key` of `never` stops the lookup. */
type Rest<K, T> = [K] extends [never] ? never : { key: K } & T;

/**
 * `<T>`'s props: a union over the schema's keys, so a key narrows its own
 * payload, and one without a schema takes any key and the parser's params.
 * One more member takes every key that needs no params, so a key held in a
 * variable typed by a union of those keys renders too: TypeScript matches an
 * object against a union of more than 25 members by discriminant only. It
 * also takes the keys without a payload, which a required trailing param of
 * the parser keeps out of the first set.
 *
 * TypeScript finds a key's member by a lookup instead of trying every member
 * only when each key names one member and the members are object types, not
 * intersections. So a key without a payload has no member of its own, and
 * every other member is flattened. The member of the keys without params
 * stays an intersection: as an object type, its `params` could become what
 * the lookup goes by.
 */
export type Props<I> = I extends I18n<infer P, any, infer S, infer L>
  ? [S] extends [never]
    ? { key: string } & Common<L> & Split<P>
    : {
      [K in Exclude<Schema.Key<S>, Plain<S, P>>]: Flat<{ key: K } & Common<L> & Split<Schema.Params<S, K, P>>>
    }[Exclude<Schema.Key<S>, Plain<S, P>>] | Rest<Bare<S, P> | Plain<S, P>, Common<L> & Split<Schema.Params<S, never, P>>>
  : never;

export type WithT<I> = I & { T: Component<Props<I>> };

/**
 * An input that is no instance — a pipe that put an extension replacing the
 * instance first — gets no `T`, so the mistake surfaces where `T` is used.
 */
export interface WithHtml extends Extension.Operator {
  readonly output: this['input'] extends AnyI18n ? WithT<this['input']> : this['input'];
}
