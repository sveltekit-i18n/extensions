import { I18n } from '@sveltekit-i18n/base';
import type { Config } from '@sveltekit-i18n/base';
import { flushSync } from 'svelte';
import { derived } from 'svelte/store';
import type { Readable } from 'svelte/store';
import { describe, expect, expectTypeOf, it } from 'vitest';

import stores from '../../src';
import type { Output } from '../../src';
import { inDestroyedEffect, subscribeInEffect } from '../effects.svelte';

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

// The stores track the instance from the microtask after the extension ran.
const tracking = () => new Promise<void>((done) => { queueMicrotask(done); });

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

  it('brings a subscriber that joins before the flush to the current value', async () => {
    const output = stores(new I18n(CONFIG));
    const first = collect(output.locale);
    const switches = [output.setLocale('cs')];
    const second = collect(output.locale);

    switches.push(output.setLocale('en'));
    await Promise.all(switches);
    flushSync();

    expect(output.instance.locale).toBe('en');
    expect(first.values.at(-1)).toBe('en');
    expect(second.values.at(-1)).toBe('en');
    first.unsubscribe();
    second.unsubscribe();
  });

  it('emits to a subscription an effect renews, and stops with the effect', async () => {
    const output = stores(new I18n(CONFIG));
    const { values, rerun, destroy } = subscribeInEffect(output.locale);

    flushSync();

    expect(values).toEqual(['en']);

    await output.setLocale('cs');
    flushSync();
    rerun();
    flushSync();

    expect(values.at(-1)).toBe('cs');

    const count = values.length;

    destroy();
    await output.setLocale('en');
    flushSync();

    expect(values).toHaveLength(count);
  });

  it('leaves an effect that subscribes independent of the value it subscribes to', async () => {
    const output = stores(new I18n(CONFIG));
    const held = collect(output.locale);
    const { values, destroy } = subscribeInEffect(output.locale);

    flushSync();
    await output.setLocale('cs');
    flushSync();

    expect(values).toEqual(['en', 'cs']);

    destroy();
    held.unsubscribe();
  });

  it('brings a subscriber back to the current value after it changed and changed back unobserved', async () => {
    const output = stores(new I18n(CONFIG));
    const first = collect(output.locale);

    await output.setLocale('cs');
    flushSync();
    first.unsubscribe();

    await output.setLocale('en');
    flushSync();

    const second = collect(output.locale);

    flushSync();

    expect(second.values.at(-1)).toBe('en');
    second.unsubscribe();
  });

  it('keeps emitting after the effect that first applied it is destroyed', async () => {
    const instance = new I18n(CONFIG);
    const output = inDestroyedEffect(() => stores(instance));
    const { values, unsubscribe } = collect(output.locale);

    await output.setLocale('cs');
    flushSync();

    expect(values).toEqual(['en', 'cs']);
    unsubscribe();
  });

  it('keeps every store emitting after the effect that first applied it is destroyed', async () => {
    const output = inDestroyedEffect(() => stores(new I18n({ ...CONFIG, translations: { ...CONFIG.translations, de: {}, sk: {} } })));
    const t = collect(output.t);
    const first = collect(output.locale);

    await output.setLocale('cs');
    flushSync();
    t.unsubscribe();
    first.unsubscribe();

    const second = collect(output.locale);

    await output.setLocale('de');
    flushSync();
    await output.setLocale('sk');
    flushSync();

    expect(second.values).toEqual(['cs', 'de', 'sk']);
    second.unsubscribe();
  });

  it('hands a change made before the stores track the instance on at the microtask after the extension ran', async () => {
    const output = stores(new I18n(CONFIG));
    const { values, unsubscribe } = collect(output.translations);

    output.addTranslations({ en: { common: { bye: 'Bye!' } } });
    flushSync();

    expect(values).toHaveLength(1);

    await tracking();

    expect(values).toHaveLength(2);
    expect(values[1].en['common.bye']).toBe('Bye!');
    unsubscribe();
  });

  it('emits a change to a subscription that starts once the stores track the instance, at the flush', async () => {
    const output = stores(new I18n(CONFIG));

    await tracking();

    const { values, unsubscribe } = collect(output.translations);

    output.addTranslations({ en: { common: { bye: 'Bye!' } } });
    flushSync();

    expect(values).toHaveLength(2);
    expect(values[1].en['common.bye']).toBe('Bye!');
    unsubscribe();
  });

  it('starts a subscription with a change made since the last flush', async () => {
    const output = stores(new I18n(CONFIG));

    await tracking();
    output.addTranslations({ en: { common: { bye: 'Bye!' } } });

    const { values, unsubscribe } = collect(output.translations);

    expect(values[0].en['common.bye']).toBe('Bye!');
    unsubscribe();
  });

  it('never pairs a store with an older value of a store it derives from', async () => {
    const output = stores(new I18n({
      ...CONFIG,
      loaders: [{ locale: 'de', key: 'common', loader: async () => ({ hi: 'Hallo!' }) }],
    }));

    await tracking();

    const pairs = derived([output.t, output.locale], ([t, locale]) => `${locale}:${t('common.hi')}`);
    const tables = derived([output.translations, output.locale], ([translations, locale]) => `${locale}:${translations[locale!]?.['common.hi']}`);
    const seen = [collect(pairs), collect(tables)];

    await output.setLocale('cs');
    flushSync();
    await output.setLocale('de');
    flushSync();

    for (const { values, unsubscribe } of seen) {
      expect(values).toEqual(['en:Hello!', 'cs:Ahoj!', 'de:Hallo!']);
      unsubscribe();
    }
  });

  it('never reports `initialized` ahead of the locale it derives from', async () => {
    const output = stores(new I18n({
      parser: CONFIG.parser,
      log: CONFIG.log,
      loaders: [{ locale: 'en', key: 'common', loader: async () => ({ hi: 'Hello!' }) }],
    }));

    await tracking();

    const seen = [
      collect(derived([output.locale, output.initialized], ([locale, initialized]) => `${locale}|${initialized}`)),
      collect(derived([output.initialized, output.locale], ([initialized, locale]) => `${locale}|${initialized}`)),
    ];

    await output.loadTranslations('en', '/');
    flushSync();

    for (const { values, unsubscribe } of seen) {
      expect(values).toEqual(['undefined|false', 'en|false', 'en|true']);
      unsubscribe();
    }
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

  it('hands out a fresh `t` wrapper when its reactive inputs change', async () => {
    const output = stores(new I18n(CONFIG));
    const { values, unsubscribe } = collect(output.t);

    expect(values).toHaveLength(1);
    expect(values[0]('common.bye')).toBe('common.bye');

    await tracking();
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
          namespace: 'lazy',
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
          namespace: 'about',
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
          namespace: 'lazy',
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

  it('keeps the namespace `invalidate` is handed', async () => {
    const calls = { a: 0, b: 0 };
    const output = stores(new I18n({
      initLocale: 'en',
      parser: CONFIG.parser,
      log: CONFIG.log,
      loaders: (['a', 'b'] as const).map((namespace) => ({
        namespace,
        locale: 'en',
        loader: async () => {
          calls[namespace] += 1;

          return { hi: `${namespace} ${calls[namespace]}` };
        },
      })),
    }));

    await output.loadTranslations('en');

    expect(calls).toEqual({ a: 1, b: 1 });

    const { invalidate } = output;

    invalidate('en', 'a');
    await output.loadTranslations('en');

    expect(calls).toEqual({ a: 2, b: 1 });
    expect(output.t.get()('a.hi')).toBe('a 2');
  });

  it('passes `loadNamespace` through, detached', async () => {
    const output = stores(new I18n({
      initLocale: 'en',
      parser: CONFIG.parser,
      log: CONFIG.log,
      translations: { en: { common: { hi: 'Hello!' } } },
      loaders: [
        {
          namespace: 'about',
          locale: 'cs',
          routes: ['/about'],
          loader: async () => ({ title: 'About us' }),
        },
      ],
    }));

    const translations = collect(output.translations);
    const { loadNamespace } = output;

    // Off its route and off the active locale: only a namespace load for
    // that locale fetches it, and it switches nothing.
    await loadNamespace('about', 'cs');
    flushSync();

    expect(translations.values.at(-1)?.cs['about.title']).toBe('About us');
    expect(output.locale.get()).toBe('en');
    translations.unsubscribe();
  });

  it('hands a snapshot over through `hydrate`, so the client fetches nothing', async () => {
    const calls = { server: 0, client: 0 };
    const config = (side: keyof typeof calls): Config.T => ({
      parser: CONFIG.parser,
      log: CONFIG.log,
      loaders: [
        {
          namespace: 'common',
          locale: 'en',
          loader: async () => {
            calls[side] += 1;

            return { hi: 'Hello!' };
          },
        },
      ],
    });

    const server = stores(new I18n(config('server')));

    await server.loadTranslations('en', '/');

    const envelope = server.snapshot({ records: true });
    const client = stores(new I18n(config('client')));
    const locale = collect(client.locale);
    const { hydrate } = client;

    hydrate(envelope);
    await tracking();

    expect(locale.values.at(-1)).toBe('en');
    expect(client.t.get()('common.hi')).toBe('Hello!');

    await client.loadTranslations('en', '/');

    expect(calls).toEqual({ server: 1, client: 0 });
    locale.unsubscribe();
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
