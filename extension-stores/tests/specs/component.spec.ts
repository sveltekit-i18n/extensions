// @vitest-environment happy-dom
import { I18n } from '@sveltekit-i18n/base';
import type { Config } from '@sveltekit-i18n/base';
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';

import stores from '../../src';
import Greeting from '../components/Greeting.svelte';
import Page from '../components/Page.svelte';
import { person } from '../effects.svelte';

const CONFIG: Config.T = {
  initLocale: 'en',
  parser: {
    parse: (text, _params, _locale, key) => text ?? key,
  },
  log: {
    level: 'error',
  },
  translations: {
    en: { common: { hi: 'Hello!' } },
    cs: { common: { hi: 'Ahoj!' } },
    de: { common: { hi: 'Hallo!' } },
  },
};

const render = (i18n: ReturnType<typeof stores>) => {
  const target = document.createElement('div');
  const component = mount(Page, { target, props: i18n });

  flushSync();

  return {
    text: () => target.textContent,
    destroy: () => void unmount(component),
  };
};

describe('stores extension, mounted', () => {
  // `$t(...)` makes the template depend on the instance's state directly, so a
  // switch re-runs the template's effect while its stores stay subscribed.
  it('keeps every store of a template current across switches', async () => {
    const i18n = stores(new I18n(CONFIG));
    const page = render(i18n);

    expect(page.text()).toBe('en|true|Hello!|Hello!');

    await i18n.setLocale('de');
    flushSync();

    expect(page.text()).toBe('de|true|Hallo!|Hallo!');

    await i18n.setLocale('cs');
    flushSync();

    expect(page.text()).toBe('cs|true|Ahoj!|Ahoj!');
    page.destroy();
  });

  it('renders the current value when remounted after a change it did not observe', async () => {
    const i18n = stores(new I18n(CONFIG));
    const first = render(i18n);

    await i18n.setLocale('cs');
    flushSync();
    first.destroy();

    await i18n.setLocale('en');
    flushSync();

    const second = render(i18n);

    expect(second.text()).toBe('en|true|Hello!|Hello!');
    second.destroy();
  });

  it('renders a `$t(...)` once per change in a component mounted after the extension ran', async () => {
    let parses = 0;
    const i18n = stores(new I18n({
      ...CONFIG,
      parser: {
        parse: (text, _params, _locale, key) => {
          parses += 1;

          return text ?? key;
        },
      },
      loaders: [{ locale: 'cs', key: 'about', routes: ['/about'], loader: async () => ({ title: 'O nás' }) }],
    }));

    // A `/kit` load, or the module that builds the instance, runs it a
    // microtask before the app mounts.
    await Promise.resolve();

    const page = render(i18n);
    const tables: object[] = [];
    const unsubscribe = i18n.translations.subscribe((value) => {
      tables.push(value);
    });

    parses = 0;
    await i18n.setLocale('cs');
    flushSync();

    expect([parses, page.text()]).toEqual([1, 'cs|true|Ahoj!|Ahoj!']);

    parses = 0;
    i18n.addTranslations({ cs: { common: { hi: 'Nazdar!' } } });
    flushSync();

    expect([parses, page.text()]).toEqual([1, 'cs|true|Nazdar!|Nazdar!']);

    parses = 0;
    await i18n.loadTranslations('cs', '/about', { activate: false });
    flushSync();

    expect(parses).toBe(1);
    expect(tables.at(-1)).toHaveProperty(['cs', 'about.title'], 'O nás');
    unsubscribe();
    page.destroy();
  });

  it('re-renders a `$t(...)` whose params change in place', () => {
    const i18n = stores(new I18n({
      ...CONFIG,
      parser: {
        parse: (text, params) => (text ?? '').replace('{name}', (params[0] as { name: string }).name),
      },
      translations: { en: { common: { greet: 'Hi {name}' } } },
    }));
    const target = document.createElement('div');
    const user = person('Ann');
    const component = mount(Greeting, { target, props: { ...i18n, user } });

    flushSync();
    expect(target.textContent).toBe('Hi Ann');

    user.name = 'Bob';
    flushSync();

    expect(target.textContent).toBe('Hi Bob');
    void unmount(component);
  });
});
