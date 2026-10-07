import I18n from '@sveltekit-i18n/base';
import { render } from 'svelte/server';
import { expect, it } from 'vitest';

import typedAccess from '../../src';
import Forgotten from '../components/Forgotten.svelte';
import Page from '../components/Page.svelte';

const loaded = async () => {
  const i18n = new I18n({
    log: { level: 'error' },
    parser: { parse: (text, _params, _locale, key) => text ?? key },
    schema: {} as { 'common.hi': never },
    loaders: [
      { locale: 'en', namespace: 'common', loader: async () => ({ hi: 'Hello!' }) },
      { locale: 'cs', namespace: 'common', loader: async () => ({ hi: 'Ahoj!' }) },
    ],
    extensions: [typedAccess],
  });

  await i18n.loadTranslations('en');

  return i18n;
};

it('renders a leaf', async () => {
  const i18n = await loaded();

  expect(render(Page, { props: { i18n } }).body).toContain('en|Hello!|Hello!|Hello!');
});

it('reads t afresh outside a render, as the instance does', async () => {
  const i18n = await loaded();

  expect(i18n.instance.t === i18n.instance.t).toBe(false);
  expect(i18n.t === i18n.t).toBe(false);
  expect(i18n.t.common.hi()).toBe('Hello!');

  await i18n.setLocale('cs');

  expect(i18n.t.common.hi()).toBe('Ahoj!');
  expect((i18n.t as any).then).toBeUndefined();
  expect((i18n.t.common as any).then).toBeUndefined();
});

it('keeps two passes apart', async () => {
  const [a, b] = await Promise.all([loaded(), loaded()]);

  await b.setLocale('cs');

  expect(render(Page, { props: { i18n: a } }).body).toContain('en|Hello!|Hello!|Hello!');
  expect(render(Page, { props: { i18n: b } }).body).toContain('cs|Ahoj!|Ahoj!|Ahoj!');
});

it('names the coercion a forgotten call ran into', async () => {
  const i18n = await loaded();

  expect(render(Forgotten, { props: { i18n } }).body).toContain('<span title="z common.hi.valueOf">common.hi.toString</span>');
});

it('forwards every member of the core as the server compiles it, and one it gains', async () => {
  class Grown extends (I18n as unknown as new (config?: object) => object) {
    #bumps = 0;

    bump() { return ++this.#bumps; }
  }

  const i18n = new Grown({ log: { level: 'error' } }) as any;
  const out = typedAccess(i18n) as any;
  const core = [...Object.keys(i18n), ...Object.getOwnPropertyNames(I18n.prototype), 'bump']
    .filter((key) => key !== 'constructor');

  expect(Object.keys(out).sort()).toEqual([...new Set([...core, 'instance'])].sort());
  expect(out.bump()).toBe(1);

  await out.loadConfig({ log: { level: 'error' }, initLocale: 'cs', translations: { cs: { hi: 'Ahoj!' } } });

  expect(out.locale).toBe('cs');
  expect(out.locales).toEqual(['cs']);
  expect(out.initialized).toBe(true);
});
