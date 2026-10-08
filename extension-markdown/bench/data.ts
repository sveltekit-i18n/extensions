import { I18n } from '@sveltekit-i18n/base';
import markdown from '@sveltekit-i18n/extension-markdown';
import type { Report } from '@sveltekit-i18n/extension-markdown';
import { render } from 'svelte/server';

// cmark's issue 389, whose openers a closer that matches none walked again and
// again: deeper than a render takes, so it renders as its text.
const crafted = (n: number) => ({
  message: `${'*a '.repeat(n)}${'_a*_ '.repeat(n)}`,
  body: `${'a '.repeat(n)}${'_a_ '.repeat(n)}`,
  reports: ['nesting-invalid'],
  renders: 5,
});

/**
 * One message per kind, with its payload and what a server render of
 * `<i18n.T key={kind} params={params} />` must give for it, Svelte's comments
 * left out; the reports it must make; and the renders a sample times.
 */
export const MESSAGES: Record<string, { message: string; params?: Record<string, string>; body: string; reports?: string[]; renders?: number }> = {
  'plain text': {
    message: 'Welcome back.',
    body: 'Welcome back.',
  },
  'inline nodes and a payload': {
    message: 'Hi **{name}**, read [the docs](/docs).',
    params: { name: '*Ann*' },
    body: 'Hi <strong>*Ann*</strong>, read <a href="/docs">the docs</a>.',
  },
  '10 paragraphs': {
    message: Array.from({ length: 10 }, (_, i) => `Item *${i}*  \nnext`).join('\n\n'),
    body: Array.from({ length: 10 }, (_, i) => `<p>Item <em>${i}</em><br>next</p>`).join('\n\n'),
  },
  'nodes it drops and reports': {
    message: '[a](javascript:x) ![b](data:x)',
    body: '<a>a</a> <img alt="b">',
    reports: ['url-blocked', 'url-blocked'],
  },
  'a crafted message of 20,000 characters': crafted(2_500),
  'a crafted message of 40,000 characters': crafted(5_000),
};

/** A parser that fills `{name}` placeholders, and returns everything else as it is. */
const parser = {
  parse: (value: unknown, [payload]: unknown[]) => (typeof value === 'string'
    ? value.replace(/\{(\w+)\}/g, (_, name: string) => (payload as Record<string, string> | undefined)?.[name] ?? '')
    : value),
};

/** An instance holding every message, which counts the reports it is made. */
export const setup = () => {
  const reports: Report[] = [];
  const i18n = new I18n({
    initLocale: 'en',
    parser,
    log: { level: 'error' },
    translations: { en: Object.fromEntries(Object.entries(MESSAGES).map(([kind, { message }]) => [kind, message])) },
    extensions: [markdown({ onReport: (report) => { reports.push(report); }, components: { paragraph: 'p', image: 'img' } })],
  });
  const ssr = (kind: string) => render(i18n.T, { props: { key: kind, params: MESSAGES[kind].params } }).body;

  return { reports, ssr };
};

/** What a render must give, checked before anything is measured. */
export const check = () => {
  const { reports, ssr } = setup();

  for (const [kind, { body, reports: expected = [] }] of Object.entries(MESSAGES)) {
    const actual = ssr(kind).replace(/<!--[^>]*-->/g, '');

    if (actual !== body) throw new Error(`The render of ${kind} gave ${actual.slice(0, 200)}, not ${body.slice(0, 200)}.`);

    const codes = reports.splice(0).map(({ code }) => code);

    if (codes.join() !== expected.join()) throw new Error(`The render of ${kind} reported ${codes.join() || 'nothing'}, not ${expected.join() || 'nothing'}.`);
  }
};
