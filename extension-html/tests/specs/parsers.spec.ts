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

describe('bidi controls in an attribute value', () => {
  const rendered = (message: string, params: Record<string, unknown>, locale = 'en') => {
    const reports: { code: string; attribute?: string }[] = [];
    const i18n = html({ onReport: (report) => reports.push(report), components: BLOCK_ELEMENTS })(new I18n({
      initLocale: locale,
      parser: mf2({ onReport: null }),
      translations: { [locale]: { k: message } },
    }));
    const page = render(i18n, () => ({ key: 'k', params }));
    const markup = page.html();

    page.destroy();

    return { markup, reports: reports.map(({ code, attribute }) => [code, attribute]) };
  };

  it.each([
    ['en', '<a href="/docs/{$slug}">a</a>', { slug: 'intro' }, '<a href="/docs/intro">a</a>'],
    ['ar', '<a href="/docs/{$slug}">a</a>', { slug: 'intro' }, '<a href="/docs/intro">a</a>'],
    ['ar', '<a href="/p/{$n}">a</a>', { n: 42 }, '<a href="/p/42">a</a>'],
    ['ar', '<a href="/docs/{$slug :string u:dir=ltr}">a</a>', { slug: 'intro' }, '<a href="/docs/intro">a</a>'],
    ['ar', '<ol start="{$n}"><li>a</li></ol>', { n: 3 }, '<ol start="3"><li>a</li></ol>'],
    ['en', '<a href="{$url}">a</a>', { url: 'https://example.com/x' }, '<a href="https://example.com/x">a</a>'],
    ['en', '<a href="https://{$host}/x">a</a>', { host: 'example.com' }, '<a href="https://example.com/x">a</a>'],
    ['en', '<a href="&#x200E;https://example.com/x&#x200E;">a</a>', {}, '<a href="https://example.com/x">a</a>'],
    ['en', '<a href="/x" target="{$t}">a</a>', { t: '_blank' }, '<a href="/x" target="_blank">a</a>'],
    ['he', '<ol><li value="{$n}">a</li></ol>', { n: -2 }, '<ol><li value="-2">a</li></ol>'],
    ['en', '<a href="/x" dir="&#x061C;&#x200F;&#x202A;&#x202B;&#x202C;&#x202D;&#x202E;rtl">a</a>', {}, '<a href="/x" dir="rtl">a</a>'],
    ['en', '<a href="/wiki/{$t}">a</a>', { t: 'a\u200cb' }, '<a href="/wiki/a\u200cb">a</a>'],
  ])('[%s] %s renders without the marks a value takes as its own', (locale, message, params, expected) => {
    expect(rendered(message, params, locale)).toEqual({ markup: expected, reports: [] });
  });

  it('keeps them in a `title`, which is text to read', () => {
    expect(rendered('<a href="/x" title="By {$n}">a</a>', { n: 'Ann' })).toEqual({ markup: '<a href="/x" title="By \u2068Ann\u2069">a</a>', reports: [] });
  });

  it.each([
    ['en', '<a href="{$url}">a</a>', { url: 'javascript:alert(1)' }],
    ['ar', '<a href="{$url}">a</a>', { url: 'javascript:alert(1)' }],
    ['en', '<a href="java{$x}script:alert(1)">a</a>', { x: '' }],
    ['en', '<a href="&#x2068;javascript:alert(1)&#x2069;">a</a>', {}],
  ])('[%s] %s is checked without the marks', (locale, message, params) => {
    expect(rendered(message, params, locale)).toEqual({ markup: '<a>a</a>', reports: [['url-blocked', 'href']] });
  });
});
