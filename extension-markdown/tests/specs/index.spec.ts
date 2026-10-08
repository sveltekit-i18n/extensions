import { I18n } from '@sveltekit-i18n/base';
import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import markdown from '../../src';
import type { Options, Report } from '../../src';
import Link from '../components/Link.svelte';
import { CONFIG } from '../data';
import { render } from '../render';
import { cell } from '../state.svelte';

const setup = (options: Partial<Options> = {}, translations: Record<string, string> = {}) => {
  const reports: Report[] = [];
  const i18n = new I18n({
    ...CONFIG,
    translations: { ...CONFIG.translations, en: { ...CONFIG.translations.en, ...translations } },
    extensions: [markdown({ onReport: (report) => reports.push(report), ...options })],
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

const spy = () => {
  const parse = vi.fn<(...args: unknown[]) => string>(() => 'ok');
  const i18n = markdown({ onReport: null })(new I18n({ ...CONFIG, parser: { parse } }));

  return { parse, i18n };
};

describe('the extension', () => {
  it('adds `T` to the instance it receives and returns that instance', () => {
    const instance = new I18n(CONFIG);
    const extended = markdown({ onReport: null })(instance);

    expect(extended).toBe(instance);
    expect(extended).toBeInstanceOf(I18n);
    expect(typeof extended.T).toBe('function');
  });

  it('is harmless applied twice', () => {
    const extension = markdown({ onReport: null });
    const i18n = extension(new I18n(CONFIG));
    const { T } = i18n;

    expect(extension(i18n).T).toBe(T);
  });

  it('replaces a `T` it made, and refuses one another extension added', () => {
    const first = markdown({ onReport: null })(new I18n(CONFIG));
    const { T } = first;

    expect(markdown({ onReport: null })(first).T).not.toBe(T);
    expect(() => markdown({ onReport: null })(Object.assign(new I18n(CONFIG), { T: () => undefined }))).toThrow(TypeError);
  });

  it('refuses to be used without its options, or after the instance was replaced', () => {
    expect(() => markdown(new I18n(CONFIG) as never)).toThrow(TypeError);
    expect(() => (markdown as (options?: unknown) => unknown)()).toThrow(TypeError);
    expect(() => markdown({ onReport: null })({ instance: new I18n(CONFIG) } as never)).toThrow(TypeError);
  });

  it('leaves `t` returning the source of a message', () => {
    const { i18n } = setup();

    expect(i18n.t('greeting', { name: 'Ann' })).toBe('Hi **Ann**, read [the docs](/docs)');
  });
});

describe('<T>', () => {
  it('renders the nodes of a message', () => {
    const { i18n } = setup();
    const page = render(i18n, () => ({ key: 'greeting', params: { name: 'Ann' } }));

    expect(page.html()).toBe('Hi <strong>Ann</strong>, read <a href="/docs">the docs</a>');
    page.destroy();
  });

  it('renders every node it maps by default', () => {
    expect(once('*a* **b** `c` [d](/e "t") <https://f.g> <h@i.j>  \nk\\\nl\nm').html)
      .toBe('<em>a</em> <strong>b</strong> <code>c</code> <a href="/e" title="t">d</a> <a href="https://f.g">https://f.g</a> <a href="mailto:h@i.j">h@i.j</a><br>k<br>l\nm');
  });

  it('decodes references and escapes', () => {
    expect(once('Tom &amp; Jerry &lt;3 &copy; \\*not\\*').text).toBe('Tom & Jerry <3 © *not*');
  });

  it('renders as text what is no inline syntax: blocks, raw HTML, reference links', () => {
    expect(once('# a\n- b\n> c\n<b>d</b> [e] [f][g]').html).toBe('# a\n- b\n&gt; c\n&lt;b&gt;d&lt;/b&gt; [e] [f][g]');
  });

  it('renders a payload as text wherever it lands', () => {
    const name = '**x** _y_ [z](javascript:alert(1)) ![i](/i.png) <https://evil.example> `c` &amp; \\* a  \nb';

    expect(once('*{name}* `{name}` [link](/u/{name} "{name}")', {}, { params: { name } }).html).toBe([
      `<em>${name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</em>`,
      `<code>${name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`,
      `<a href="/u/${name.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" title="${name.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">link</a>`,
    ].join(' '));
  });

  it('lets a payload pair no delimiters far from it', () => {
    expect(once('[a *b]({u}) c*', {}, { params: { u: 'o\fk' } }).html).toBe('<a href="o\uFFFDk">a *b</a> c*');
  });

  it('reads an autolink a payload fills as the browser gets it', () => {
    expect(once('Write to <{e}>, see <{u}>', {}, { params: { e: "john_o'doe@example.com", u: 'https://example.com/a_b' } }).html)
      .toBe('Write to <a href="mailto:john_o\'doe@example.com">john_o\'doe@example.com</a>, see <a href="https://example.com/a_b">https://example.com/a_b</a>');
    expect(once('<{u}>', {}, { params: { u: 'https://example.com/>x' } }).html).toBe('&lt;https://example.com/&gt;x&gt;');
  });

  it('keeps the keys of the payload and leaves a parser that serializes it no markup', () => {
    const { parse, i18n } = spy();
    const page = render(i18n, () => ({ key: 'plain', params: { user: { first_name: 'A*n', '*k*': 1 } } }));
    const [payload] = parse.mock.calls[0][1] as [{ user: Record<string, unknown> }];

    expect(Object.keys(payload.user)).toEqual(['first_name', '*k*']);
    expect(JSON.stringify(payload)).not.toMatch(/[*]/);
    page.destroy();
  });

  it('hands the parser any other object as it is, and a symbol as its inert string', () => {
    const MARKDOWN = '[x](/evil) *em*';
    const date = new Date(0);
    const url = new URL('https://example.com/x)*pwn*[evil](https://attacker.example/');
    const { parse, i18n } = spy();
    const page = render(i18n, () => ({ key: 'plain', params: { date, url } }));
    const [payload] = parse.mock.calls[0][1] as [Record<string, unknown>];

    expect(payload.date).toBe(date);
    expect(payload.url).toBe(url);
    page.destroy();

    expect(once('[docs]({u})', {}, { params: { u: url.href } }).html).toBe(`<a href="${url.href}">docs</a>`);
    expect(once('{v}', {}, { params: { v: Symbol(MARKDOWN) } }).html).toBe(`Symbol(${MARKDOWN})`);
  });

  it('keeps the holes of an array in the payload where they were', () => {
    const { parse, i18n } = spy();
    const list: string[] = [];

    list[1] = 'b';
    render(i18n, () => ({ key: 'plain', params: { list } })).destroy();
    expect((parse.mock.calls[0][1] as [{ list: string[] }])[0].list).toEqual(list);
  });

  it('hands `args` to the parser after the payload, as they are', () => {
    const { parse, i18n } = spy();
    const page = render(i18n, () => ({ key: 'plain', params: { n: 1 }, args: [{ timeZone: 'America/New_York' }] }));

    expect(parse.mock.calls[0][1]).toEqual([{ n: 1 }, { timeZone: 'America/New_York' }]);
    page.destroy();
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
    expect(page.html()).toBe('Hi <strong>Ann</strong>, read <a href="/docs">the docs</a>');

    props.value = { key: 'greeting', params: { name: 'Bob' } };
    flushSync();
    expect(page.html()).toBe('Hi <strong>Bob</strong>, read <a href="/docs">the docs</a>');

    await i18n.setLocale('cs');
    flushSync();
    expect(page.html()).toBe('Ahoj <strong>Bob</strong>, přečti si <a href="/docs">dokumentaci</a>');
    page.destroy();
  });

  it('renders text a parser returns that is no string', () => {
    const i18n = markdown({ onReport: null })(new I18n({ ...CONFIG, parser: { parse: () => 42 } }));
    const page = render(i18n, () => ({ key: 'plain' }));

    expect(page.html()).toBe('42');
    page.destroy();
  });

  it('drops the line endings a message ends with, and keeps its spaces otherwise', () => {
    expect(once('foo  \n').html).toBe('foo');
    expect(once('foo\\\r\n\n').html).toBe('foo\\');
    expect(once(' a ').html).toBe(' a ');
  });

  it('splits a message into paragraphs at a blank line, which no node spans', () => {
    const { html: markup, reports } = once('*a\n \nb*');

    expect(markup).toBe('*a\n\nb*');
    expect(reports.map(({ code, node }) => [code, node])).toEqual([['node-unmapped', 'paragraph'], ['node-unmapped', 'paragraph']]);
    expect(once('a  \n\n\n  *b*', { components: { paragraph: 'p' } }).html).toBe('<p>a</p>\n\n<p><em>b</em></p>');
    expect(once('a\n\nb', { components: { paragraph: null } }).reports).toEqual([]);
  });

  it('renders an autolink in a link\'s text as its text', () => {
    const { html: markup, reports } = once('[go <https://a.example>](/c)');

    expect(markup).toBe('<a href="/c">go https://a.example</a>');
    expect(reports.map(({ code, node }) => [code, node])).toEqual([['nesting-invalid', 'link']]);
  });

  it('renders an image as its description unless it is mapped', () => {
    const { html: markup, reports } = once('![a *b*](/i.png "t")');

    expect(markup).toBe('a b');
    expect(reports.map(({ code, node }) => [code, node])).toEqual([['node-unmapped', 'image']]);
    expect(once('![a *b*](/i.png "t")', { components: { image: 'img' } }).html).toBe('<img src="/i.png" title="t" alt="a b">');
    expect(once('[![a *b*](/i.png)](/out)').html).toBe('<a href="/out">a b</a>');
    // A link in the description deactivates the brackets before it, as in any text.
    expect(once('[![a [b](/c) d](/i.png)](/out)').html).toBe('[a b d](/out)');
  });

  it('renders an unmapped break as its line ending', () => {
    expect(once('a  \nb', { components: { break: null } }).html).toBe('a\nb');
  });

  it('renders as text a message that nests nodes more than 32 deep', () => {
    const deep = (levels: number) => `${'['.repeat(levels)}x${'](/u)'.repeat(levels)}`;
    const { html: markup, reports } = once(`${'*'.repeat(66)}x${'*'.repeat(66)}`);

    expect(markup).toBe('x');
    expect(reports.map(({ code }) => code)).toEqual(['nesting-invalid']);
    expect(once(`${'*'.repeat(64)}x${'*'.repeat(64)}`).html).toBe(`${'<strong>'.repeat(32)}x${'</strong>'.repeat(32)}`);
    expect(once(deep(40), { components: { image: 'img' } }).reports).toEqual([]);
  });
});

describe('the component map', () => {
  it('renders a node as another element or as a component, with the entry\'s props on top', () => {
    const { html: markup } = once('**a** [b](/x)', {
      components: { strong: 'b', link: { component: Link, props: { rel: 'noopener' } } },
    });

    expect(markup).toBe('<b>a</b> <a data-link="" href="/x" rel="noopener">b</a>');
  });

  it('lets the usage outrank the config, and `null` unmap a node without a report', () => {
    const options = { components: { strong: 'b' } };

    expect(once('**a**', options, { components: { strong: 'em' } }).html).toBe('<em>a</em>');
    expect(once('**a**', options, { components: { strong: null } })).toMatchObject({ html: 'a', reports: [] });
    expect(once('**a**', { components: { strong: null } })).toMatchObject({ html: 'a', reports: [] });
  });

  it('takes no prototype member for an entry', () => {
    const components = Object.create({ strong: 'b' }) as Options['components'];

    expect(once('**a**', { components }).html).toBe('<strong>a</strong>');
  });
});

describe('URLs from a translation', () => {
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
    ['java&#09;script:alert(1)', false],
    ['&#106;avascript:alert(1)', false],
    ['javascript&colon;alert(1)', false],
    ['<javascript:alert(1)>', false],
    ['&#x2068;javascript:alert(1)&#x2069;', false],
    ['data:text/html,x', false],
    ['vbscript:x', false],
  ])('gate the link to `%s` by its scheme (allowed: %s)', (href, allowed) => {
    const { html: markup, reports } = once(`[a](${href})`);

    expect(markup.includes('href')).toBe(allowed);
    expect(reports.map(({ code, node, attribute }) => [code, node, attribute])).toEqual(allowed ? [] : [['url-blocked', 'link', 'href']]);
  });

  it('gate an autolink as a link', () => {
    expect(once('<javascript:alert(1)>').html).toBe('<a>javascript:alert(1)</a>');
  });

  it.each([
    ['/i.png', true],
    ['https://example.com/i.png', true],
    ['mailto:a@example.com', false],
    ['tel:+420123', false],
    ['data:image/png;base64,x', false],
    ['javascript:alert(1)', false],
  ])('gate the image `%s` by its scheme (allowed: %s)', (src, allowed) => {
    const { html: markup, reports } = once(`![a](${src})`, { components: { image: 'img' } });

    expect(markup.includes('src')).toBe(allowed);
    expect(reports.map(({ code, node, attribute }) => [code, node, attribute])).toEqual(allowed ? [] : [['url-blocked', 'image', 'src']]);
  });
});

describe('reports', () => {
  it('survive a channel that throws', () => {
    expect(once('![a](/i)', { onReport: () => { throw new Error('channel'); } }).html).toBe('a');
  });

  it('reach a channel that writes state', () => {
    const reports = cell<Report[]>([]);
    const { html: markup } = once('![a](/i)', { onReport: (report) => { reports.value = [...reports.value, report]; } });

    expect(markup).toBe('a');
    expect(reports.value.map(({ code }) => code)).toEqual(['node-unmapped']);
  });

  it('go nowhere with `onReport: null`', () => {
    expect(once('![a](/i)', { onReport: null }).html).toBe('a');
  });

  it('name the key and the locale the message rendered in', () => {
    const reports: Report[] = [];
    const i18n = new I18n({
      ...CONFIG,
      translations: { ...CONFIG.translations, cs: { ...CONFIG.translations.cs, picture: '![a](/i)' } },
      extensions: [markdown({ onReport: (report) => reports.push(report) })],
    });

    render(i18n, () => ({ key: 'picture', locale: 'cs' })).destroy();

    expect(reports.map(({ code, node, key, locale }) => [code, node, key, locale])).toEqual([['node-unmapped', 'image', 'picture', 'cs']]);
  });
});
