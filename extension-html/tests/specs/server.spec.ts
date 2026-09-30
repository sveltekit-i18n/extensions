import { I18n } from '@sveltekit-i18n/base';
import { defaultTreeAdapter, html as parse5, parseFragment } from 'parse5';
import type { DefaultTreeAdapterTypes } from 'parse5';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';

import html, { BLOCK_ELEMENTS } from '../../src';
import type { Report } from '../../src';
import Link from '../components/Link.svelte';
import Page from '../components/Page.svelte';
import { CONFIG } from '../data';

const ssr = (props: Record<string, unknown>, components = {}) => {
  const reports: Report[] = [];
  const i18n = new I18n({ ...CONFIG, extensions: [html({ onReport: (report) => reports.push(report), components })] });
  const { body } = render(Page, { props: { i18n, props } });

  // Svelte's hydration anchors are comments; what is asserted is the markup around them.
  return { body: body.replace(/<!--[^>]*-->/g, ''), reports };
};

describe('<T> on the server', () => {
  it('renders the elements of a message', () => {
    expect(ssr({ key: 'greeting', params: { name: '<i>Ann</i>' } }).body)
      .toBe('Hi <b>&lt;i>Ann&lt;/i></b>, read <a href="/docs">the docs</a>');
  });

  it('renders in the locale it is given', () => {
    expect(ssr({ key: 'plain', locale: 'cs' }).body).toBe('Ahoj!');
  });

  it('renders the entries of the map, and reports what it drops', () => {
    const { body, reports } = ssr(
      { key: 'greeting', params: { name: 'Ann' } },
      { ...BLOCK_ELEMENTS, b: 'strong', a: { component: Link, props: { rel: 'noopener' } }, x: null },
    );

    expect(body).toBe('Hi <strong>Ann</strong>, read <a data-link="" href="/docs" rel="noopener">the docs</a>');
    expect(reports).toEqual([]);
  });

  it('reports on the server too', () => {
    const i18n = new I18n({
      ...CONFIG,
      translations: { en: { k: '<x>a</x><a href="javascript:x">b</a>' } },
      extensions: [html({ onReport: (report) => reports.push(report) })],
    });
    const reports: Report[] = [];
    const { body } = render(Page, { props: { i18n, props: { key: 'k' } } });

    expect(body.replace(/<!--[^>]*-->/g, '')).toBe('a<a>b</a>');
    expect(reports.map(({ code }) => code)).toEqual(['url-blocked', 'tag-unmapped']);
  });

  it('keeps a newline that leads a `<pre>` through the parse of its markup', () => {
    const i18n = new I18n({
      ...CONFIG,
      translations: { en: { k: '<pre>\n\nx</pre>' } },
      extensions: [html({ onReport: null, components: BLOCK_ELEMENTS })],
    });
    const { body } = render(Page, { props: { i18n, props: { key: 'k' } } });
    const [pre] = parseFragment(defaultTreeAdapter.createElement('body', parse5.NS.HTML, []), body, {}).childNodes
      .filter((node) => defaultTreeAdapter.isElementNode(node) && node.tagName === 'pre');
    const text = defaultTreeAdapter.getChildNodes(pre as DefaultTreeAdapterTypes.ParentNode)
      .map((node) => (defaultTreeAdapter.isTextNode(node) ? node.value : ''))
      .join('');

    expect(text).toBe('\nx');
  });
});
