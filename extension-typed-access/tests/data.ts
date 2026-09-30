import type { Config } from '@sveltekit-i18n/base';

export const calls: unknown[][] = [];

export const CONFIG = {
  initLocale: 'en',
  log: { level: 'error' },
  parser: {
    parse: (text: unknown, params: unknown[], _locale: string, key: string) => {
      calls.push([key, params]);

      return text ?? key;
    },
  },
  preprocess: 'none',
  translations: {
    en: { 'common.hi': 'Hi', 'common.name': 'Name', 'a': 'A', 'a.b': 'AB', 'name.x': 'reserved-x', 'form.name': 'FN', 'list.0': 'L0', 'odd key': 'Odd' },
    cs: { 'common.hi': 'Ahoj', 'common.name': 'Jméno', 'a': 'A-cs', 'a.b': 'AB-cs' },
  },
} satisfies Config.T<any, any>;
