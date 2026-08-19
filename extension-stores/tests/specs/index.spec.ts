import { I18n } from '@sveltekit-i18n/base';
import type { Config } from '@sveltekit-i18n/base';
import { flushSync } from 'svelte';
import type { Readable } from 'svelte/store';
import { describe, expect, expectTypeOf, it } from 'vitest';

import stores from '../../src';
import type { Output } from '../../src';

const CONFIG: Config.T = {
  initLocale: 'en',
  parser: {
    // Echo the key for missing translations so assertions can spot them.
    parse: (text, _params, _locale, key) => text ?? key,
  },
  log: {
    level: 'error',
  },
  translations: {
    en: { common: { hi: 'Hello!' } },
    cs: { common: { hi: 'Ahoj!' } },
  },
};

const collect = <T>(store: Readable<T>) => {
  const values: T[] = [];
  const unsubscribe = store.subscribe((value) => {
    values.push(value);
  });

  return { values, unsubscribe };
};

describe('stores extension', () => {
  it('exposes stores with initial values and a `get` dual', () => {
    const output = stores(new I18n(CONFIG));

    expect(output.locale.get()).toBe('en');
    expect(output.locales.get()).toEqual(['en', 'cs']);
    expect(output.loading.get()).toBe(false);
    expect(output.initialized.get()).toBe(true);
    expect(output.translations.get().en['common.hi']).toBe('Hello!');
    expect(output.t.get()('common.hi')).toBe('Hello!');
    expect(output.l.get()('cs', 'common.hi')).toBe('Ahoj!');
  });

  it('emits on subscribed stores when the locale changes', async () => {
    const output = stores(new I18n(CONFIG));
    const { values, unsubscribe } = collect(output.locale);

    expect(values).toEqual(['en']);

    await output.setLocale('cs');
    flushSync();

    expect(values).toEqual(['en', 'cs']);
    unsubscribe();
  });

  it('setting the writable `locale` store triggers a locale switch', async () => {
    const output = stores(new I18n(CONFIG));

    const next = new Promise((resolve) => {
      let initial = true;
      const unsubscribe = output.locale.subscribe((value) => {
        if (initial) {
          initial = false;

          return;
        }

        unsubscribe();
        resolve(value);
      });
    });

    output.locale.set('cs');

    expect(await next).toBe('cs');
    expect(output.instance.locale).toBe('cs');
  });

  it('hands out a fresh `t` wrapper when its reactive inputs change', () => {
    const output = stores(new I18n(CONFIG));
    const { values, unsubscribe } = collect(output.t);

    expect(values).toHaveLength(1);
    expect(values[0]('common.bye')).toBe('common.bye');

    output.addTranslations({ en: { common: { bye: 'Bye!' } } });
    flushSync();

    expect(values).toHaveLength(2);
    expect(values[1]).not.toBe(values[0]);
    expect(values[1]('common.bye')).toBe('Bye!');
    unsubscribe();
  });

  it('re-emits `t` and `l` when the config changes', async () => {
    const output = stores(new I18n(CONFIG));
    const t = collect(output.t);
    const l = collect(output.l);

    expect(t.values[0]('common.hi')).toBe('Hello!');
    expect(l.values[0]('cs', 'common.hi')).toBe('Ahoj!');

    await output.loadConfig({
      parser: { parse: (text, _params, _locale, key) => `[${text ?? key}]` },
    });
    flushSync();

    expect(t.values).toHaveLength(2);
    expect(t.values[1]('common.hi')).toBe('[Hello!]');
    expect(l.values).toHaveLength(2);
    expect(l.values[1]('cs', 'common.hi')).toBe('[Ahoj!]');
    t.unsubscribe();
    l.unsubscribe();
  });

  it('tracks in-flight loads through the `loading` store', async () => {
    const output = stores(new I18n({
      ...CONFIG,
      loaders: [
        {
          key: 'lazy',
          locale: 'de',
          loader: async () => ({ hi: 'Hallo!' }),
        },
      ],
    }));

    expect(output.loading.get()).toBe(false);

    const load = output.setLocale('de');

    flushSync();
    expect(output.loading.get()).toBe(true);

    await load;
    flushSync();
    expect(output.loading.get()).toBe(false);
    expect(output.t.get()('lazy.hi')).toBe('Hallo!');
  });

  it('emits through a route-scoped load driven by `setRoute`', async () => {
    const output = stores(new I18n({
      initLocale: 'en',
      parser: CONFIG.parser,
      log: CONFIG.log,
      loaders: [
        {
          key: 'about',
          locale: 'en',
          routes: ['/about'],
          loader: async () => ({ title: 'About us' }),
        },
      ],
    }));

    const loading = collect(output.loading);
    const initialized = collect(output.initialized);
    const translations = collect(output.translations);
    const locales = collect(output.locales);

    expect(locales.values).toEqual([['en']]);

    await output.setRoute('/about');
    flushSync();

    expect(loading.values).toEqual([false, true, false]);
    expect(initialized.values).toEqual([false, true]);
    expect(translations.values.at(-1)?.en['about.title']).toBe('About us');
    loading.unsubscribe();
    initialized.unsubscribe();
    translations.unsubscribe();
    locales.unsubscribe();
  });

  it('refetches after `invalidate`, and not before it', async () => {
    let calls = 0;
    const output = stores(new I18n({
      initLocale: 'en',
      parser: CONFIG.parser,
      log: CONFIG.log,
      loaders: [
        {
          key: 'lazy',
          locale: 'en',
          loader: async () => {
            calls += 1;

            return { hi: `Hello ${calls}!` };
          },
        },
      ],
    }));

    const l = collect(output.l);

    await output.loadTranslations('en');

    expect(calls).toBe(1);

    // Load-once: the bookkeeping suppresses the loader until it is dropped.
    await output.loadTranslations('en');

    expect(calls).toBe(1);

    output.invalidate('en');
    await output.loadTranslations('en');
    flushSync();

    expect(calls).toBe(2);
    expect(l.values.at(-1)?.('en', 'lazy.hi')).toBe('Hello 2!');
    l.unsubscribe();
  });

  it('applies through the `config.extensions` pipe', async () => {
    const output = new I18n({ ...CONFIG, extensions: [stores] });

    expect(output.t.get()('common.hi')).toBe('Hello!');
    expect(stores(output.instance)).toBe(output);

    const { values, unsubscribe } = collect(output.locale);

    await output.setLocale('cs');
    flushSync();

    expect(values).toEqual(['en', 'cs']);
    expect(output.instance.t('common.hi')).toBe('Ahoj!');
    unsubscribe();
  });

  it('keeps the constructed surface typed through the pipe', () => {
    type Schema = { 'common.hi': { name: string } };

    const output = new I18n({
      parser: CONFIG.parser,
      log: CONFIG.log,
      initLocale: 'en',
      fallbackLocale: 'cs',
      schema: {} as Schema,
      translations: { en: { common: { hi: 'Hello!' } } },
      extensions: [stores],
    });

    // The instance the extension was folded over survives whole: the locale
    // union the config spelled and the schema that narrows `t` are both intact.
    expectTypeOf(output.locale.get()).toEqualTypeOf<'en' | 'cs' | (string & {}) | undefined>();
    expect(output.t.get()('common.hi', { name: 'Jarda' })).toBe('Hello!');
    // @ts-expect-error the schema still closes the key set behind the pipe
    output.t.get()('common.missing');
  });

  it('mirrors the instance surface member for member', () => {
    // `instance` is this extension's escape hatch; any other divergence means
    // the surface drifted and must be reconciled.
    expectTypeOf<Exclude<keyof I18n, keyof Output>>().toEqualTypeOf<never>();
    expectTypeOf<Exclude<keyof Output, keyof I18n>>().toEqualTypeOf<'instance'>();
  });

  it('exposes the pre-preprocess tables through `rawTranslations`', () => {
    const output = stores(new I18n(CONFIG));

    expect(output.translations.get().en['common.hi']).toBe('Hello!');
    expect(output.rawTranslations.get().en.common).toEqual({ hi: 'Hello!' });
  });

  it('passes `snapshot` and `destroy` through', async () => {
    const output = stores(new I18n(CONFIG));

    expect(output.snapshot()).toEqual({ en: { common: { hi: 'Hello!' } } });

    output.destroy();

    // Reads keep working on a destroyed instance, so the stores stay valid.
    expect(output.t.get()('common.hi')).toBe('Hello!');
    expect(output.locale.get()).toBe('en');

    await output.setLocale('cs');

    expect(output.locale.get()).toBe('en');
  });

  it('is memoized per instance', () => {
    const i18n = new I18n(CONFIG);

    expect(stores(i18n)).toBe(stores(i18n));
    expect(stores(i18n)).not.toBe(stores(new I18n(CONFIG)));

    // A destroyed instance keeps serving reads, so its output stays memoized.
    i18n.destroy();

    expect(stores(i18n)).toBe(stores(i18n));
  });

  it('passes the instance methods through, detached and bound', async () => {
    const { setLocale, instance } = stores(new I18n(CONFIG));

    await setLocale('cs');

    expect(instance.locale).toBe('cs');
    expect(instance.t('common.hi')).toBe('Ahoj!');
  });
});
