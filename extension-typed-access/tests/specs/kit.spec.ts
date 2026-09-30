// @vitest-environment happy-dom
import { defineI18n } from '@sveltekit-i18n/base/kit';
import { expect, it } from 'vitest';

import typedAccess from '../../src';

it('hands the tree out of the universal load', async () => {
  const { load } = defineI18n({
    parser: { parse: (text, _params, _locale, key) => text ?? key },
    log: { level: 'error' },
    schema: {} as { 'common.greeting': never },
    loaders: [
      { locale: 'en', namespace: 'common', loader: async () => ({ greeting: 'Hi' }) },
      { locale: 'cs', namespace: 'common', loader: async () => ({ greeting: 'Ahoj' }) },
    ],
    extensions: [typedAccess],
  });
  const data = await load({
    url: new URL('https://x.test/'), params: {}, route: { id: '/' },
    data: { i18n: { locale: 'cs', route: '/', translations: { cs: { 'common.greeting': 'Ahoj' } } } },
  } as any);

  expect(data.i18n.t.common.greeting()).toBe('Ahoj');
  expect((data.i18n.t as any).then).toBeUndefined();
  expect((data as any).then).toBeUndefined();
  expect(data.i18n.instance.t('common.greeting')).toBe('Ahoj');
});
