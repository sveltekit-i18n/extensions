import { toStore } from 'svelte/store';
import type { Readable, Writable } from 'svelte/store';
import type { Extension, I18n } from '@sveltekit-i18n/base';

type AnyI18n = I18n<any, any, any, any>;

export type WithGet<Store, Value> = Store & { get: () => Value };

export interface Stores<I extends AnyI18n = AnyI18n> {
  t: WithGet<Readable<I['t']>, I['t']>;
  l: WithGet<Readable<I['l']>, I['l']>;
  locale: WithGet<Writable<I['locale']>, I['locale']>;
  locales: WithGet<Readable<I['locales']>, I['locales']>;
  loading: WithGet<Readable<I['loading']>, I['loading']>;
  initialized: WithGet<Readable<I['initialized']>, I['initialized']>;
  translations: WithGet<Readable<I['translations']>, I['translations']>;
  rawTranslations: WithGet<Readable<I['rawTranslations']>, I['rawTranslations']>;
}

export interface Output<I extends AnyI18n = AnyI18n> extends Stores<I> {
  loadTranslations: I['loadTranslations'];
  setLocale: I['setLocale'];
  setRoute: I['setRoute'];
  loadConfig: I['loadConfig'];
  addTranslations: I['addTranslations'];
  invalidate: I['invalidate'];
  snapshot: I['snapshot'];
  destroy: I['destroy'];
  instance: I;
}

/**
 * The output is derived from the instance the pipe hands over, so the
 * `schema` keys and the locale union survive `config.extensions`.
 */
export interface WithStores extends Extension.Operator {
  readonly output: Output<Extract<this['input'], AnyI18n>>;
}

const cache = new WeakMap<object, Output>();

const withGet = <S extends Readable<unknown>, V>(store: S, get: () => V): WithGet<S, V> => Object.assign(store, { get });

const stores = <I extends AnyI18n>(i18n: I): Output<I> => {
  const memoized = cache.get(i18n);

  if (memoized) return memoized as Output<I>;

  const output: Output = {
    t: withGet(toStore(() => i18n.t), () => i18n.t),
    l: withGet(toStore(() => i18n.l), () => i18n.l),
    locale: withGet(
      toStore(() => i18n.locale, (locale) => {
        // Assignment is the instance's fire-and-forget `setLocale()`.
        i18n.locale = locale;
      }),
      () => i18n.locale,
    ),
    locales: withGet(toStore(() => i18n.locales), () => i18n.locales),
    loading: withGet(toStore(() => i18n.loading), () => i18n.loading),
    initialized: withGet(toStore(() => i18n.initialized), () => i18n.initialized),
    translations: withGet(toStore(() => i18n.translations), () => i18n.translations),
    rawTranslations: withGet(toStore(() => i18n.rawTranslations), () => i18n.rawTranslations),
    loadTranslations: i18n.loadTranslations,
    setLocale: i18n.setLocale,
    setRoute: i18n.setRoute,
    loadConfig: i18n.loadConfig,
    addTranslations: i18n.addTranslations,
    invalidate: i18n.invalidate,
    snapshot: i18n.snapshot,
    destroy: i18n.destroy,
    instance: i18n,
  };

  cache.set(i18n, output);

  return output as Output<I>;
};

export default stores as typeof stores & Extension.Generic<WithStores>;
