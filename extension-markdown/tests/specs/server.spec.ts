import { I18n } from '@sveltekit-i18n/base';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';

import markdown from '../../src';
import type { Components, Report } from '../../src';
import Link from '../components/Link.svelte';
import Page from '../components/Page.svelte';
import { CONFIG } from '../data';

const ssr = (props: Record<string, unknown>, components: Components = {}, translations: Record<string, string> = {}) => {
  const reports: Report[] = [];
  const i18n = new I18n({
    ...CONFIG,
    translations: { ...CONFIG.translations, en: { ...CONFIG.translations.en, ...translations } },
    extensions: [markdown({ onReport: (report) => reports.push(report), components })],
  });
  const { body } = render(Page, { props: { i18n, props } });

  // Svelte's hydration anchors are comments; what is asserted is the markup around them.
  return { body: body.replace(/<!--[^>]*-->/g, ''), reports };
};

describe('<T> on the server', () => {
  it('renders the nodes of a message', () => {
    expect(ssr({ key: 'greeting', params: { name: '<i>*Ann*</i>' } }).body)
      .toBe('Hi <strong>&lt;i>*Ann*&lt;/i></strong>, read <a href="/docs">the docs</a>');
  });

  it('renders in the locale it is given', () => {
    expect(ssr({ key: 'greeting', params: { name: 'Ann' }, locale: 'cs' }).body)
      .toBe('Ahoj <strong>Ann</strong>, přečti si <a href="/docs">dokumentaci</a>');
  });

  it('renders the entries of the map', () => {
    const { body, reports } = ssr(
      { key: 'greeting', params: { name: 'Ann' } },
      { strong: 'b', link: { component: Link, props: { rel: 'noopener' } } },
    );

    expect(body).toBe('Hi <b>Ann</b>, read <a data-link="" href="/docs" rel="noopener">the docs</a>');
    expect(reports).toEqual([]);
  });

  it('reports on the server too', () => {
    const { body, reports } = ssr({ key: 'k' }, {}, { k: '![a](/i) [b](javascript:x)' });

    expect(body).toBe('a <a>b</a>');
    expect(reports.map(({ code, node }) => [code, node])).toEqual([['url-blocked', 'link'], ['node-unmapped', 'image']]);
  });

  it('renders paragraphs and breaks as the client does', () => {
    expect(ssr({ key: 'k' }, { paragraph: 'p' }, { k: 'a  \nb\n\nc' }).body).toBe('<p>a<br>b</p>\n\n<p>c</p>');
  });
});
