import { I18n } from '@sveltekit-i18n/base';
import type { Config } from '@sveltekit-i18n/base';

/** Two locales seeded with the same 100 keys, behind a parser that returns the value. */
export const CONFIG: Config.T = {
  initLocale: 'en',
  parser: { parse: (value) => value },
  log: { level: 'error' },
  translations: Object.fromEntries(['en', 'cs'].map((locale) => [locale, Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, `${locale} ${i}`]))])),
};

export const instance = () => new I18n(CONFIG);

/** The stores track the instance from the microtask after the extension ran. */
export const tracking = () => new Promise<void>((done) => { queueMicrotask(done); });

export const STORES = ['t', 'l', 'locale', 'locales', 'loading', 'initialized', 'translations', 'rawTranslations'] as const;
