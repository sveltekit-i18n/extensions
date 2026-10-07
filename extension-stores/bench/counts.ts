import stores from '@sveltekit-i18n/extension-stores';
import { flushSync } from 'svelte';

import type { Measure } from '../../bench/bench.js';

import { instance, STORES, tracking } from './data.js';

/**
 * How many times the stores call their subscribers when the instance
 * changes, one subscriber on each store: what a page of `$t`, `$locale` and
 * the rest re-renders for.
 */
const measure: Measure = async ({ record }) => {
  const output = stores(instance());
  let emissions = 0;

  await tracking();

  for (const name of STORES) {
    output[name].subscribe(() => {
      emissions += 1;
    });
  }

  if (emissions !== STORES.length) throw new Error(`A subscriber was called ${emissions} times on subscribing to ${STORES.length} stores.`);

  emissions = 0;
  await output.setLocale('cs');
  flushSync();
  if (output.t.get()('k1') !== 'cs 1') throw new Error('The locale switch did not land.');
  record('emissions to a subscriber of each store, per locale switch', 'count', 'calls', emissions);

  emissions = 0;
  output.addTranslations({ cs: { added: 'cs added' } });
  flushSync();
  record('emissions to a subscriber of each store, per addTranslations() to the active locale', 'count', 'calls', emissions);

  emissions = 0;
  output.locale.set('en');
  await output.instance.setLocale('en');
  flushSync();
  record('emissions to a subscriber of each store, per locale switch through the locale store', 'count', 'calls', emissions);
};

export default measure;
