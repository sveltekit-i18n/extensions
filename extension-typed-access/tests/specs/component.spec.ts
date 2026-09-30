// @vitest-environment happy-dom
import I18n from '@sveltekit-i18n/base';
import { flushSync, mount, unmount } from 'svelte';
import { expect, it } from 'vitest';

import typedAccess from '../../src';
import Forgotten from '../components/Forgotten.svelte';
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
