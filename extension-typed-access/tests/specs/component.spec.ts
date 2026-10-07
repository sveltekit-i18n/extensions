// @vitest-environment happy-dom
import I18n from '@sveltekit-i18n/base';
import html from '@sveltekit-i18n/extension-html';
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';

import typedAccess from '../../src';
import Forgotten from '../components/Forgotten.svelte';
import Html from '../components/Html.svelte';
import Page from '../components/Page.svelte';

it('re-renders {t.common.hi()} on a switch', async () => {
  const i18n = new I18n({
    initLocale: 'en',
    log: { level: 'error' },
    parser: { parse: (text, _params, _locale, key) => text ?? key },
    schema: {} as { 'common.hi': never },
    translations: { en: { common: { hi: 'Hi' } }, cs: { common: { hi: 'Ahoj' } } },
    extensions: [typedAccess],
  });
  const target = document.createElement('div');
  const component = mount(Page, { target, props: { i18n } });

  flushSync();
  expect(target.textContent).toBe('en|Hi|Hi|Hi');

  await i18n.setLocale('cs');
  flushSync();
  expect(target.textContent).toBe('cs|Ahoj|Ahoj|Ahoj');

  await i18n.setLocale('en');
  flushSync();
  expect(target.textContent).toBe('en|Hi|Hi|Hi');

  await unmount(component);
});

it('names the coercion a forgotten call ran into', async () => {
  const i18n = new I18n({ initLocale: 'en', log: { level: 'error' }, parser: { parse: (text, _params, _locale, key) => text ?? key }, translations: { en: { common: { hi: 'Hi' } } }, extensions: [typedAccess] });
  const target = document.createElement('div');
  const component = mount(Forgotten, { target, props: { i18n } });

  flushSync();
  expect(target.innerHTML).toContain('<span title="z common.hi.toString">common.hi.toString</span>');

  await unmount(component);
});

describe('with extension-html', () => {
  const config = {
    initLocale: 'en',
    log: { level: 'error' },
    parser: { parse: (text: unknown, _params: unknown[], _locale: string, key: string) => text ?? key },
    schema: {} as { 'common.hi': never; 'common.rich': never },
    translations: {
      en: { common: { hi: 'Hi', rich: 'Hi <b>there</b>' } },
      cs: { common: { hi: 'Ahoj', rich: 'Ahoj <b>tam</b>' } },
    },
  } as const;

  const renders = async (i18n: { setLocale: (locale: string) => Promise<void> }, T: any) => {
    const target = document.createElement('div');
    const component = mount(Html, { target, props: { T } });

    flushSync();
    expect(target.textContent).toBe('Hi there');
    expect(target.querySelector('b')?.textContent).toBe('there');

    await i18n.setLocale('cs');
    flushSync();
    expect(target.textContent).toBe('Ahoj tam');
    expect(target.querySelector('b')?.textContent).toBe('tam');

    await unmount(component);
  };

  it('adds T beside the tree after it', async () => {
    const out = new I18n({ ...config, extensions: [typedAccess, html({ onReport: null })] });

    expect(out.t.common.hi()).toBe('Hi');
    expect(typedAccess(out)).toBe(out);
    expect(typedAccess(out.instance)).toBe(out);
    expect(out.instance).not.toHaveProperty('T');

    await renders(out, out.T);

    expect(out.t.common.hi()).toBe('Ahoj');
  });

  it('leaves T at instance.T before it', async () => {
    const out = new I18n({ ...config, extensions: [html({ onReport: null }), typedAccess] });

    expect(out.t.common.hi()).toBe('Hi');
    expect(typedAccess(out)).toBe(out);
    // Forwarded at runtime, typed on `instance` only.
    expect((out as any).T).toBe(out.instance.T);

    await renders(out, out.instance.T);

    expect(out.t.common.hi()).toBe('Ahoj');
  });
});
