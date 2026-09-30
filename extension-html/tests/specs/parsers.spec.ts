import { I18n } from '@sveltekit-i18n/base';
import type { Parser } from '@sveltekit-i18n/base';
import curly from '@sveltekit-i18n/parser-curly';
import i18next from '@sveltekit-i18n/parser-i18next';
import icu from '@sveltekit-i18n/parser-icu';
import mf2 from '@sveltekit-i18n/parser-mf2';
import { describe, expect, it } from 'vitest';

import html, { BLOCK_ELEMENTS } from '../../src';
import { render } from '../render';

const NAME = '<i>Ann</i> & Bob';
const OUTPUT = 'Hi <b>&lt;i&gt;Ann&lt;/i&gt; &amp; Bob</b>, read <a href="/docs">the docs</a>';

const renders = <P extends Parser.Params>(parser: Parser.T<P>, message: string) => {
  const i18n = html({ onReport: null })(new I18n({ initLocale: 'en', parser, translations: { en: { k: message } } }));
  const page = render(i18n, () => ({ key: 'k', params: { name: NAME } }));
  const markup = page.html();

  page.destroy();

  // MF2 isolates each placeholder in U+2068 and U+2069.
  return markup.replace(/[⁨⁩]/g, '');
};

describe('the official parsers', () => {
  it('parser-curly passes markup through', () => {
    expect(renders(curly({ onReport: null }), 'Hi <b>{{name}}</b>, read <a href="/docs">the docs</a>')).toBe(OUTPUT);
  });

  it('parser-mf2 passes markup through', () => {
    expect(renders(mf2({ onReport: null }), 'Hi <b>{$name}</b>, read <a href="/docs">the docs</a>')).toBe(OUTPUT);
  });

  it('parser-i18next passes markup through', () => {
    expect(renders(i18next({ onReport: null }), 'Hi <b>{{name}}</b>, read <a href="/docs">the docs</a>')).toBe(OUTPUT);
  });

  it('parser-icu passes markup through with `ignoreTag: true`', () => {
    expect(renders(icu({ onReport: null, ignoreTag: true }), 'Hi <b>{name}</b>, read <a href="/docs">the docs</a>')).toBe(OUTPUT);
  });

  it('parser-icu reads markup as its own tags without it', () => {
    const reports: unknown[] = [];

    renders(icu({ onReport: (report) => reports.push(report) }), 'Hi <b>{name}</b>, read <a href="/docs">the docs</a>');
    expect(reports).not.toEqual([]);
  });

  it('lets no payload a parser serialises into a value spell an attribute', () => {
    const i18n = html({ onReport: null, components: BLOCK_ELEMENTS })(new I18n({
      initLocale: 'en',
      parser: curly({ onReport: null }),
      translations: { en: { k: '<details title="{{o}}"><summary>s</summary></details><a href="/x" title="{{o}}">a</a>' } },
    }));

    [{ 'open=': 1 }, { 'x target=': 1 }, ['x target=', 1], [' open=', 1], { a: ' open=' }].forEach((o) => {
      const page = render(i18n, () => ({ key: 'k', params: { o } }));
      const markup = page.html();

      page.destroy();
      expect(markup).not.toMatch(/open|target/);
    });
  });
});
