import { I18n } from '@sveltekit-i18n/base';
import { defaultTreeAdapter, html as parse5, parseFragment, serialize } from 'parse5';
import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import html, { BLOCK_ELEMENTS } from '../../src';
import { parse } from '../../src/parse';
import { apply, hydrates } from '../../src/render';
import type { Options, Report } from '../../src';
import Cell from '../components/Cell.svelte';
import Link from '../components/Link.svelte';
import { CONFIG } from '../data';
import { render } from '../render';
import { cell } from '../state.svelte';

const setup = (options: Partial<Options> = {}, translations: Record<string, string> = {}) => {
  const reports: Report[] = [];
  const i18n = new I18n({
    ...CONFIG,
    translations: { ...CONFIG.translations, en: { ...CONFIG.translations.en, ...translations } },
    extensions: [html({ onReport: (report) => reports.push(report), ...options })],
  });

  return { i18n, reports };
};

const once = (translation: string, options: Partial<Options> = {}, props: Record<string, unknown> = {}) => {
  const { i18n, reports } = setup(options, { k: translation });
  const page = render(i18n, () => ({ key: 'k', ...props }));
  const result = { html: page.html(), text: page.target.textContent, reports };

  page.destroy();

  return result;
};

describe('the extension', () => {
  it('adds `T` to the instance it receives and returns that instance', () => {
    const instance = new I18n(CONFIG);
    const extended = html({ onReport: null })(instance);

    expect(extended).toBe(instance);
    expect(extended).toBeInstanceOf(I18n);
    expect(typeof extended.T).toBe('function');
  });

  it('is harmless applied twice', () => {
    const extension = html({ onReport: null });
    const i18n = extension(new I18n(CONFIG));
    const { T } = i18n;

    expect(extension(i18n).T).toBe(T);
  });

  it('refuses to be used without its options, or after the instance was replaced', () => {
    expect(() => html(new I18n(CONFIG) as never)).toThrow(TypeError);
    expect(() => (html as (options?: unknown) => unknown)()).toThrow(TypeError);
    expect(() => html({ onReport: null })({ instance: new I18n(CONFIG) } as never)).toThrow(TypeError);
  });

  it('leaves `t` returning the source of a message', () => {
    const { i18n } = setup();

    expect(i18n.t('greeting', { name: 'Ann' })).toBe('Hi <b>Ann</b>, read <a href="/docs">the docs</a>');
  });
});

describe('<T>', () => {
  it('renders the inline elements of a message', () => {
    const { i18n } = setup();
    const page = render(i18n, () => ({ key: 'greeting', params: { name: 'Ann' } }));

    expect(page.html()).toBe('Hi <b>Ann</b>, read <a href="/docs">the docs</a>');
    page.destroy();
  });

  it('decodes entities', () => {
    expect(once('Tom &amp; Jerry &lt;3').text).toBe('Tom & Jerry <3');
  });

  it('renders a payload as text, in content and in attributes alike', () => {
    const { html: markup } = once('<b>{name}</b><a href="/x" title="{name}">x</a>', {}, {
      params: { name: '<i>x</i>" onclick="alert(1)' },
    });

    expect(markup).toBe('<b>&lt;i&gt;x&lt;/i&gt;" onclick="alert(1)</b><a href="/x" title="<i>x</i>&quot; onclick=&quot;alert(1)">x</a>');
  });

  it('keeps the holes of an array in the payload where they were', () => {
    const parse = vi.fn<(...args: unknown[]) => string>(() => 'ok');
    const i18n = html({ onReport: null })(new I18n({ ...CONFIG, parser: { parse } }));
    const list: string[] = [];

    list[1] = 'b';
    render(i18n, () => ({ key: 'plain', params: { list } })).destroy();
    expect((parse.mock.calls[0][1] as [{ list: string[] }])[0].list).toEqual(list);
  });

  it('escapes strings and keys nested in the payload and leaves other objects to the parser', () => {
    const date = new Date(0);
    const parse = vi.fn<(...args: unknown[]) => string>(() => 'ok');
    const i18n = html({ onReport: null })(new I18n({ ...CONFIG, parser: { parse } }));
    const page = render(i18n, () => ({ key: 'plain', params: { list: ['<a>'], user: { name: '<b>', '"': 'k' }, date } }));

    expect(parse.mock.calls[0][1]).toEqual([{ list: ['&#60;a&#62;'], user: { name: '&#60;b&#62;', '&#34;': 'k' }, date }]);
    expect((parse.mock.calls[0][1] as [{ date: Date }])[0].date).toBe(date);
    page.destroy();
  });

  it('hands `args` to the parser after the payload', () => {
    const parse = vi.fn<(...args: unknown[]) => string>(() => 'ok');
    const i18n = html({ onReport: null })(new I18n({ ...CONFIG, parser: { parse } }));
    const page = render(i18n, () => ({ key: 'plain', params: { n: 1 }, args: ['formats'] }));

    expect(parse.mock.calls[0][1]).toEqual([{ n: 1 }, 'formats']);
    page.destroy();
  });

  it('lets a payload spell no attribute in an unquoted value, since none is taken', () => {
    const { html: markup, reports } = once('<a title={name}>x</a>', {}, { params: { name: 'Ann href=https://evil.com' } });

    expect(markup).toBe('<a>x</a>');
    expect(reports.map(({ attribute }) => attribute)).toEqual(['title', 'href']);
  });

  it('leaves a payload what the parser selects by', () => {
    const parse = vi.fn<(...args: unknown[]) => string>(() => 'ok');
    const i18n = html({ onReport: null })(new I18n({ ...CONFIG, parser: { parse } }));

    render(i18n, () => ({ key: 'plain', params: { v: 'a b=c/d' } })).destroy();
    expect(parse.mock.calls[0][1]).toEqual([{ v: 'a b=c/d' }]);
  });

  it('renders a payload that cannot be walked as none', () => {
    const params = { get name(): string { throw new Error('getter'); } };

    expect(once('Hi {name}!', {}, { params }).html).toBe('Hi !');
  });

  it('renders in the locale it is given', () => {
    const { i18n } = setup();
    const page = render(i18n, () => ({ key: 'plain', locale: 'cs' }));

    expect(page.html()).toBe('Ahoj!');
    page.destroy();
  });

  it('follows its props, the active locale and the loaded translations', async () => {
    const { i18n } = setup();
    const props = cell<Record<string, unknown>>({ key: 'plain' });
    const page = render(i18n, () => props.value);

    expect(page.html()).toBe('Hello!');

    props.value = { key: 'greeting', params: { name: 'Ann' } };
    flushSync();
    expect(page.html()).toBe('Hi <b>Ann</b>, read <a href="/docs">the docs</a>');

    props.value = { key: 'greeting', params: { name: 'Bob' } };
    flushSync();
    expect(page.html()).toBe('Hi <b>Bob</b>, read <a href="/docs">the docs</a>');

    await i18n.setLocale('cs');
    flushSync();
    expect(page.html()).toBe('Ahoj <b>Bob</b>, přečti si <a href="/docs">dokumentaci</a>');
    page.destroy();
  });

  it('renders text a parser returns that is no string', () => {
    const i18n = html({ onReport: null })(new I18n({ ...CONFIG, parser: { parse: () => 42 } }));
    const page = render(i18n, () => ({ key: 'plain' }));

    expect(page.html()).toBe('42');
    page.destroy();
  });

  it('repairs malformed markup as a browser does', () => {
    expect(once('a</b>c<i>d').html).toBe('ac<i>d</i>');
    expect(once('<b>x<i>y</b>z').html).toBe('<b>x<i>y</i></b><i>z</i>');
  });

  it('drops comments, and every raw-text element with its content', () => {
    const { html: markup, reports } = once(
      'a<!-- c -->b<script>alert(1)</script>c<style>*{}</style>d<title><b>t</b></title>e<textarea>t</textarea>f<xmp>x</xmp>g<plaintext>rest',
    );

    expect(markup).toBe('abcdefg');
    expect(reports.map(({ code, tag }) => [code, tag])).toEqual(
      ['script', 'style', 'title', 'textarea', 'xmp', 'plaintext'].map((tag) => ['tag-dropped', tag]),
    );
  });

  it('renders markup the HTML parser builds the same tree from', () => {
    const reparsed = (markup: string) => serialize(parseFragment(defaultTreeAdapter.createElement('body', parse5.NS.HTML, []), markup, {}));

    [
      ['<a href="/a">p <b>q <a href="/b">x</a></b></a>', '<a href="/a">p <b>q </b></a><b><a href="/b">x</a></b>'],
      ['<table><tr><td>a</td></tr></table>', '<table><tbody><tr><td>a</td></tr></tbody></table>'],
      ['<table><p>Note<tr><td>A</td></tr></table>after', '<p>Note</p><table><tbody><tr><td>A</td></tr></tbody></table>after'],
      ['Hi <table>there</table> end', 'Hi there<table></table> end'],
      ['<tr><td>a</td></tr> <td>b</td>', 'a b'],
      ['<p>a<li>b</li>c</p>', '<p>a</p><li>b</li>c<p></p>'],
      ['<p><b><div>x</div></b></p>', '<p><b></b></p><div><b>x</b></div><p></p>'],
      ['<li>a<b><li>b</li></b></li>', '<li>a<b></b></li><li><b>b</b></li>'],
    ].forEach(([translation, expected]) => {
      const { html: markup } = once(translation, { components: BLOCK_ELEMENTS });

      expect(markup).toBe(expected);
      expect(reparsed(markup)).toBe(markup);
    });
  });

  it('reports no tag the parser implied', () => {
    const { html: markup, reports } = once('<table><tr><td>a</td></tr></table>');

    expect(markup).toBe('a');
    expect(reports.map(({ tag }) => tag)).toEqual(['table', 'tr', 'td']);
  });

  it('renders as text a message the map would render into markup that does not parse back', () => {
    const block = { components: BLOCK_ELEMENTS };

    [
      ['<h1>A<x><h2>B</h2></x></h1>', block, 'AB'],
      ['<ul><li>a<menu><li>b</li></menu></li></ul>', block, 'ab'],
      ['<table><tr><td>a</td></tr></table>', { components: { ...BLOCK_ELEMENTS, tbody: null } }, 'a'],
    ].forEach(([translation, options, expected]) => {
      const { html: markup, reports } = once(translation as string, options as Partial<Options>);

      expect(markup).toBe(expected);
      expect(reports.map(({ code }) => code)).toContain('nesting-invalid');
    });
  });

  it('checks a component in the place of the tag it renders', () => {
    const { html: markup, reports } = once('<table><tr><td>a</td></tr></table>', { components: { ...BLOCK_ELEMENTS, td: Cell } });

    expect(markup).toBe('<table><tbody><tr><td class="cell">a</td></tr></tbody></table>');
    expect(reports).toEqual([]);
  });

  it('renders as text a message that nests elements more than 32 deep', () => {
    const { html: markup, reports } = once(`${'<b>'.repeat(33)}<script>s</script>x`);

    expect(markup).toBe('x');
    expect(reports.map(({ code, tag }) => [code, tag])).toEqual([['nesting-invalid', undefined], ['tag-dropped', 'script']]);
    expect(once(`${'<b>'.repeat(32)}x`).html).toBe(`${'<b>'.repeat(32)}x${'</b>'.repeat(32)}`);
  });

  it('parses and checks an element of any number of children', () => {
    const { parts, dropped } = parse(`<b>${'<br>'.repeat(140000)}`);
    const nodes = apply(parts, ({ tag }) => ({ render: tag, props: {} }));

    expect(dropped).toEqual([]);
    expect(nodes).toMatchObject([{ render: 'b', children: { length: 140000 } }]);
    expect(hydrates(nodes)).toBe(true);
  });

  it('renders SVG and MathML as their text', () => {
    const { html: markup, reports } = once('<math><tr><td>x</td></tr></math><svg><style>s</style><a>y</a></svg>', { components: BLOCK_ELEMENTS });

    expect(markup).toBe('xy');
    expect(reports.map(({ code, tag }) => [code, tag])).toEqual([
      ['tag-unmapped', 'math'],
      ['tag-unmapped', 'tr'],
      ['tag-unmapped', 'td'],
      ['tag-unmapped', 'svg'],
      ['tag-dropped', 'style'],
      ['tag-unmapped', 'a'],
    ]);
  });

  it('renders a void element without children', () => {
    expect(once('a<br>b').html).toBe('a<br>b');
  });
});

describe('the component map', () => {
  it('unwraps an unmapped tag and reports it', () => {
    const { html: markup, reports } = once('a <custom>b</custom> <constructor>c</constructor>');

    expect(markup).toBe('a b c');
    expect(reports.map(({ code, tag, key, locale }) => [code, tag, key, locale])).toEqual([
      ['tag-unmapped', 'custom', 'k', 'en'],
      ['tag-unmapped', 'constructor', 'k', 'en'],
    ]);
  });

  it('keeps block elements off unless enabled', () => {
    expect(once('<p>a</p>').html).toBe('a');
    expect(once('<p>a</p>', { components: BLOCK_ELEMENTS }).html).toBe('<p>a</p>');
    expect(once('<p>a</p>', {}, { components: BLOCK_ELEMENTS }).html).toBe('<p>a</p>');
  });

  it('never ships a capability in a set', () => {
    const translation = '<img src="/x.png"><form><input></form><iframe src="/x"></iframe><base href="/x"><meta http-equiv="refresh">x';

    expect(once(translation, { components: BLOCK_ELEMENTS }).html).toBe('x');
  });

  it('renders a tag as another element or as a component, with the entry\'s props on top', () => {
    const { html: markup } = once('<b>a</b><a href="/x">b</a>', {
      components: { b: 'strong', a: { component: Link, props: { rel: 'noopener' } } },
    });

    expect(markup).toBe('<strong>a</strong><a data-link="" href="/x" rel="noopener">b</a>');
  });

  it('lets the usage outrank the config, and `null` unmap a tag', () => {
    const options = { components: { b: 'strong' } };

    expect(once('<b>a</b>', options, { components: { b: 'em' } }).html).toBe('<em>a</em>');
    expect(once('<b>a</b>', options, { components: { b: null } }).html).toBe('a');
    expect(once('<b>a</b>', { components: { b: null } }).html).toBe('a');
  });
});

describe('attributes from a translation', () => {
  it('pass by the allowlist of their tag, and the rest is dropped and reported', () => {
    const { html: markup, reports } = once(
      '<a href="/x" target="_blank" hreflang="cs" title="t" onclick="x" class="c" style="color:red" id="i" ping="/p" download>a</a>',
    );

    expect(markup).toBe('<a href="/x" target="_blank" hreflang="cs" title="t">a</a>');
    expect(reports.map(({ code, attribute }) => [code, attribute])).toEqual([
      ['attribute-dropped', 'onclick'],
      ['attribute-dropped', 'class'],
      ['attribute-dropped', 'style'],
      ['attribute-dropped', 'id'],
      ['attribute-dropped', 'ping'],
      ['attribute-dropped', 'download'],
    ]);
  });

  it('take no prototype member for an attribute', () => {
    expect(once('<b __proto__="x" constructor="y">a</b>').html).toBe('<b>a</b>');
  });

  it('are on when boolean, whatever their value, and keep their string otherwise', () => {
    expect(once('<details open><summary>s</summary>b</details>', { components: BLOCK_ELEMENTS }).html)
      .toBe('<details open=""><summary>s</summary>b</details>');
    expect(once('<ol reversed="false" start="2"><li>a</li></ol>', { components: BLOCK_ELEMENTS }).html)
      .toBe('<ol reversed="" start="2"><li>a</li></ol>');
    expect(once('<a href title>a</a>').html).toBe('<a href="" title="">a</a>');
  });

  it('take an integer only where the DOM sets a number', () => {
    const { html: markup, reports } = once('<ol start="x"><li value="q">a</li><li value="3">b</li></ol>', { components: BLOCK_ELEMENTS });

    expect(markup).toBe('<ol><li>a</li><li value="3">b</li></ol>');
    expect(once('<ol><li value="99999999999999999999">a</li></ol>', { components: BLOCK_ELEMENTS }).html).toBe('<ol><li>a</li></ol>');
    expect(once('<ol><li value="0012">a</li><li value="-0">b</li></ol>', { components: BLOCK_ELEMENTS }).html).toBe('<ol><li>a</li><li>b</li></ol>');
    expect(reports.map(({ code, attribute }) => [code, attribute])).toEqual([
      ['attribute-dropped', 'start'],
      ['attribute-dropped', 'value'],
    ]);
  });

  it('are decided once for an element and every copy the parser makes of it', () => {
    const { html: markup, reports } = once('<a title={name}>a<p>b</a>c', {}, { params: { name: 'x href=/elsewhere' } });

    expect(markup).toBe('<a>a</a><a>b</a>c');
    expect(reports.map(({ code, attribute }) => [code, attribute])).toEqual([
      ['attribute-dropped', 'title'],
      ['attribute-dropped', 'href'],
      ['tag-unmapped', undefined],
    ]);
  });

  it('are decided once for an element the parser reopens', () => {
    const { html: markup, reports } = once('<p><a href="/x" onclick="1">a</p>b', { components: BLOCK_ELEMENTS });

    expect(markup).toBe('<p><a href="/x">a</a></p><a href="/x">b</a>');
    expect(reports.map(({ code, attribute }) => [code, attribute])).toEqual([['attribute-dropped', 'onclick']]);
  });

  it('are all dropped where a quote shows the quoting broke', () => {
    const { html: markup, reports } = once('<a title="{"a":"b"}" href="/x">x</a>');

    expect(markup).toBe('<a>x</a>');
    expect(reports.map(({ attribute }) => attribute)).toEqual(['title', 'a":"b"}"', 'href']);
  });

  it.each([
    ['/docs', true],
    ['#top', true],
    ['docs/page', true],
    ['https://example.com', true],
    ['HTTP://example.com', true],
    ['mailto:a@example.com', true],
    ['tel:+420123', true],
    ['javascript:alert(1)', false],
    ['JaVaScRiPt:alert(1)', false],
    ['  javascript:alert(1)', false],
    ['java&#09;script:alert(1)', false],
    ['java&#10;script:alert(1)', false],
    ['&#106;avascript:alert(1)', false],
    ['javascript&colon;alert(1)', false],
    ['data:text/html,x', false],
    ['vbscript:x', false],
    ['sms:+420123', false],
  ])('gate `href="%s"` by its scheme (allowed: %s)', (href, allowed) => {
    const { html: markup, reports } = once(`<a href="${href}">a</a>`);

    expect(markup.includes('href')).toBe(allowed);
    expect(reports.map(({ code }) => code)).toEqual(allowed ? [] : ['url-blocked']);
  });
});

describe('reports', () => {
  it('survive a channel that throws', () => {
    const { html: markup } = once('<x>a</x>', { onReport: () => { throw new Error('channel'); } });

    expect(markup).toBe('a');
  });

  it('reach a channel that writes state', () => {
    const reports = cell<Report[]>([]);
    const { html: markup } = once('<x>a</x>', { onReport: (report) => { reports.value = [...reports.value, report]; } });

    expect(markup).toBe('a');
    expect(reports.value.map(({ code }) => code)).toEqual(['tag-unmapped']);
  });

  it('go nowhere with `onReport: null`', () => {
    expect(once('<x>a</x>', { onReport: null }).html).toBe('a');
  });

  it('name the locale the message rendered in', () => {
    const { reports } = once('', {}, { key: 'greeting', params: { name: 'Ann' }, locale: 'cs', components: { b: null } });

    expect(reports.map(({ code, tag, key, locale }) => [code, tag, key, locale])).toEqual([
      ['tag-unmapped', 'b', 'greeting', 'cs'],
    ]);
  });
});
