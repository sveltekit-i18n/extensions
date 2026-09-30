import type { Config } from '@sveltekit-i18n/base';

/** A parser that fills `{name}` placeholders and returns everything else as it is. */
export const parser: Config.T['parser'] = {
  parse: (text, [payload], _locale, key) => (typeof text === 'string'
    ? text.replace(/\{(\w+)\}/g, (_, name: string) => String((payload as Record<string, string | number> | undefined)?.[name] ?? ''))
    : key),
};

export const CONFIG = {
  initLocale: 'en',
  parser,
  log: { level: 'error' },
  translations: {
    en: {
      plain: 'Hello!',
      greeting: 'Hi <b>{name}</b>, read <a href="/docs">the docs</a>',
      entity: 'Tom &amp; Jerry',
    },
    cs: {
      plain: 'Ahoj!',
      greeting: 'Ahoj <b>{name}</b>, přečti si <a href="/docs">dokumentaci</a>',
      entity: 'Tom &amp; Jerry',
    },
  },
} satisfies Config.T;
