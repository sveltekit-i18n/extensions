import { I18n } from '@sveltekit-i18n/base';
import html, { BLOCK_ELEMENTS } from '@sveltekit-i18n/extension-html';
import type { Report } from '@sveltekit-i18n/extension-html';
import { render } from 'svelte/server';

/**
 * One message per kind, with its payload and what a server render of
 * `<i18n.T key={kind} params={params} />` must give for it, Svelte's comments
 * left out; and the reports it must make.
 */
export const MESSAGES: Record<string, { message: string; params?: Record<string, string>; body: string; reports?: string[] }> = {
  'plain text': {
    message: 'Welcome back.',
    body: 'Welcome back.',
  },
  'inline elements and a payload': {
    message: 'Hi <b>{name}</b>, read <a href="/docs">the docs</a>.',
    params: { name: '<i>Ann</i>' },
    body: 'Hi <b>&lt;i>Ann&lt;/i></b>, read <a href="/docs">the docs</a>.',
  },
  'a list of 10 items': {
    message: `<ul>${Array.from({ length: 10 }, (_, i) => `<li>Item <em>${i}</em></li>`).join('')}</ul>`,
    body: `<ul>${Array.from({ length: 10 }, (_, i) => `<li>Item <em>${i}</em></li>`).join('')}</ul>`,
  },
  'markup it drops and reports': {
    message: '<x>a</x><a href="javascript:x" onclick="x">b</a>',
    body: 'a<a>b</a>',
    reports: ['url-blocked', 'attribute-dropped', 'tag-unmapped'],
  },
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
    extensions: [html({ onReport: (report) => { reports.push(report); }, components: BLOCK_ELEMENTS })],
  });
  const ssr = (kind: string) => render(i18n.T, { props: { key: kind, params: MESSAGES[kind].params } }).body;

  return { reports, ssr };
};

/** What a render must give, checked before anything is measured. */
export const check = () => {
  const { reports, ssr } = setup();

  for (const [kind, { body, reports: expected = [] }] of Object.entries(MESSAGES)) {
    const actual = ssr(kind).replace(/<!--[^>]*-->/g, '');

    if (actual !== body) throw new Error(`The render of ${kind} gave ${actual}, not ${body}.`);

    const codes = reports.splice(0).map(({ code }) => code);

    if (codes.join() !== expected.join()) throw new Error(`The render of ${kind} reported ${codes.join() || 'nothing'}, not ${expected.join() || 'nothing'}.`);
  }
};
