import { I18n } from '@sveltekit-i18n/base';
import type { Config } from '@sveltekit-i18n/base';
import { render } from 'svelte/server';
import { derived, get, toStore } from 'svelte/store';
import { describe, expect, it } from 'vitest';

import stores from '../../src';
import Page from '../components/Page.svelte';

const CONFIG: Config.T = {
  parser: {
    parse: (text, _params, _locale, key) => text ?? key,
  },
  log: {
    level: 'error',
  },
  loaders: [
    { locale: 'en', namespace: 'common', loader: async () => ({ hi: 'Hello!' }) },
    { locale: 'cs', namespace: 'common', loader: async () => ({ hi: 'Ahoj!' }) },
  ],
};

// The extension runs in the constructor, before any load has landed — as it
// does on every server pass.
const loaded = async (locale = 'en') => {
  const i18n = new I18n({ ...CONFIG, extensions: [stores] });

  await i18n.loadTranslations(locale);

  return i18n;
};

describe('stores extension, server build', () => {
  it('runs on the server build of `toStore`, which snapshots its source', () => {
    let value = 'before';
    const store = toStore(() => value);

    value = 'after';

    expect(get(store)).toBe('before');
  });

  it('reads a store\'s first value from the instance, not from the pipe', async () => {
    const i18n = await loaded();

    expect(get(i18n.locale)).toBe('en');
    expect(get(i18n.locales)).toEqual(['en', 'cs']);
    expect(get(i18n.initialized)).toBe(true);
    expect(get(i18n.loading)).toBe(false);
    expect(get(i18n.translations).en['common.hi']).toBe('Hello!');
    expect(get(i18n.rawTranslations).en.common).toEqual({ hi: 'Hello!' });
    expect(get(i18n.t)('common.hi')).toBe('Hello!');
    expect(get(i18n.l)('en', 'common.hi')).toBe('Hello!');
    expect(i18n.locale.get()).toBe('en');
    expect(i18n.t.get()('common.hi')).toBe('Hello!');
  });

  it('reads the instance on every subscription', async () => {
    const i18n = await loaded();
    const { locale, t } = i18n;

    await i18n.loadTranslations('cs');

    expect(i18n.locale).toBe(locale);
    expect(get(locale)).toBe('cs');
    expect(get(t)('common.hi')).toBe('Ahoj!');
  });

  it('drives the instance through `set` and `update`', async () => {
    const i18n = await loaded();

    // A warm load activates nothing by itself: it joins the switch in flight.
    i18n.locale.set('cs');
    await i18n.instance.loadTranslations('cs', undefined, { activate: false });

    expect(i18n.instance.locale).toBe('cs');

    i18n.locale.update((locale) => (locale === 'cs' ? 'en' : 'cs'));
    await i18n.instance.loadTranslations('en', undefined, { activate: false });

    expect(i18n.instance.locale).toBe('en');
  });

  it('feeds a derived store', async () => {
    const i18n = await loaded();

    expect(get(derived([i18n.locale, i18n.initialized], ([locale, initialized]) => `${locale}|${initialized}`))).toBe('en|true');
  });

  it('renders what the pass loaded', async () => {
    const i18n = await loaded();
    const { body } = render(Page, { props: i18n });

    expect(body).toContain('en|true|Hello!|Hello!');
  });
});
