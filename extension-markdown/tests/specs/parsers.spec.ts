import { I18n } from '@sveltekit-i18n/base';
import type { Parser } from '@sveltekit-i18n/base';
import curly from '@sveltekit-i18n/parser-curly';
import i18next from '@sveltekit-i18n/parser-i18next';
import icu from '@sveltekit-i18n/parser-icu';
import mf2 from '@sveltekit-i18n/parser-mf2';
import { describe, expect, it } from 'vitest';

import markdown from '../../src';
import type { Report } from '../../src';
import { render } from '../render';

const NAME = '*Ann* & [Bob](/x) <i>';
const OUTPUT = 'Hi <strong>*Ann* &amp; [Bob](/x) &lt;i&gt;</strong>, read <a href="/docs">the docs</a> or <a href="https://example.com">https://example.com</a>';

// MF2 isolates each placeholder in U+2068 and U+2069.
const withoutIsolates = (text: string) => text.replace(/[⁨⁩]/g, '');

const rendered = <P extends Parser.Params>(parser: Parser.T<P>, message: string, props: Record<string, unknown> = {}, locale = 'en') => {
  const reports: Report[] = [];
  const i18n = markdown({ onReport: (report) => reports.push(report), components: { image: 'img' } })(
    new I18n({ initLocale: locale, parser, translations: { [locale]: { k: message } } }),
  );
  const page = render(i18n, () => ({ key: 'k', ...props }));
  const markup = page.html();

  page.destroy();

  return { markup, reports: reports.map(({ code, node, attribute }) => [code, node, attribute]) };
};

describe('the official parsers', () => {
  it('parser-curly leaves the payload text', () => {
    expect(rendered(curly({ onReport: null }), 'Hi **{{name}}**, read [the docs](/docs) or <https://example.com>', { params: { name: NAME } }).markup).toBe(OUTPUT);
  });

  it('parser-mf2 leaves the payload text', () => {
    expect(withoutIsolates(rendered(mf2({ onReport: null }), 'Hi **{$name}**, read [the docs](/docs) or <https://example.com>', { params: { name: NAME } }).markup)).toBe(OUTPUT);
  });

  it('parser-i18next leaves the payload text', () => {
    expect(rendered(i18next({ onReport: null }), 'Hi **{{name}}**, read [the docs](/docs) or <https://example.com>', { params: { name: NAME } }).markup).toBe(OUTPUT);
  });

  it('parser-icu leaves the payload text, and an autolink with `ignoreTag: true`', () => {
    expect(rendered(icu({ onReport: null, ignoreTag: true }), 'Hi **{name}**, read [the docs](/docs) or <https://example.com>', { params: { name: NAME } }).markup).toBe(OUTPUT);
  });

  it('parser-icu reads an autolink as a tag of its own without it', () => {
    const reports: unknown[] = [];

    rendered(icu({ onReport: (report) => reports.push(report) }), 'See <https://example.com>');
    expect(reports).not.toEqual([]);
  });

  it('lets no key of an object parser-curly serialises spell markup', () => {
    const { markup } = rendered(curly({ onReport: null }), 'See {{o}}', { params: { o: { '[x](javascript:alert(1))': '*a*', '<https://x.example>': 1 } } });

    expect(markup).toBe('See {"[x](javascript:alert(1))":"*a*","&lt;https://x.example&gt;":1}');
  });

  it('formats with the options of the call and of a wrapper', () => {
    const date = new Date(Date.UTC(2020, 0, 2, 23));

    expect(rendered(curly({ onReport: null }), '*{{d:date}}*', { params: { d: new Date(Date.UTC(2020, 0, 3, 2)) }, args: [{ date: { timeZone: 'America/New_York', dateStyle: 'short' } }] }).markup)
      .toBe('<em>1/2/20</em>');
    expect(rendered(curly({ onReport: null }), '*{{d:date}}*', { params: { d: date }, args: [{ date: { timeZone: 'UTC', dateStyle: 'short' } }] }).markup)
      .toBe('<em>1/2/20</em>');
    expect(rendered(curly({ onReport: null }), '*{{d:date}}*', { params: { d: { value: date, props: { date: { timeZone: 'Asia/Tokyo', dateStyle: 'short' } } } } }).markup)
      .toBe('<em>1/3/20</em>');
  });
});

describe('bidi controls in a URL', () => {
  it.each([
    ['en', '[go]({$u})', { u: '/docs/intro' }, '<a href="/docs/intro">go</a>'],
    ['ar', '[go](/p/{$n})', { n: 42 }, '<a href="/p/42">go</a>'],
    ['en', '![{$a}]({$u})', { a: 'A', u: 'https://example.com/i.png' }, '<img src="https://example.com/i.png" alt="⁨A⁩">'],
    ['en', '[go]({$u} "By {$n}")', { u: '/x', n: 'Ann' }, '<a href="/x" title="By ⁨Ann⁩">go</a>'],
  ])('[%s] %s renders without the marks a value takes as its own', (locale, message, params, expected) => {
    expect(rendered(mf2({ onReport: null }), message, { params }, locale)).toEqual({ markup: expected, reports: [] });
  });

  it.each([
    ['en', '[go]({$u})', { u: 'javascript:alert(1)' }],
    ['ar', '[go]({$u})', { u: 'javascript:alert(1)' }],
    ['en', '[go](java{$x}script:alert(1))', { x: '' }],
  ])('[%s] %s is checked without the marks', (locale, message, params) => {
    expect(rendered(mf2({ onReport: null }), message, { params }, locale)).toEqual({ markup: '<a>go</a>', reports: [['url-blocked', 'link', 'href']] });
  });

  it('reads an autolink a placeholder fills', () => {
    expect(rendered(mf2({ onReport: null }), 'See <{$u}>', { params: { u: 'https://example.com/a_b' } }).markup)
      .toBe('See <a href="https://example.com/a_b">⁨https://example.com/a_b⁩</a>');
    expect(rendered(mf2({ onReport: null }), 'See <{$u}>', { params: { u: 'javascript:alert(1)' } }))
      .toEqual({ markup: 'See <a>⁨javascript:alert(1)⁩</a>', reports: [['url-blocked', 'link', 'href']] });
  });
});
