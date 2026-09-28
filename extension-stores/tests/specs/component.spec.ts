// @vitest-environment happy-dom
import { I18n } from '@sveltekit-i18n/base';
import type { Config } from '@sveltekit-i18n/base';
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';

import stores from '../../src';
import Page from '../components/Page.svelte';

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
});
