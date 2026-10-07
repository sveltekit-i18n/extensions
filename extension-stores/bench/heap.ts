import stores from '@sveltekit-i18n/extension-stores';
import { flushSync } from 'svelte';

import type { Measure } from '../../bench/bench.js';

import { instance, tracking } from './data.js';

/** What the stores hold. A pointer kept per subscription or per instance reads 8 B or more. */
const measure: Measure = async ({ bounded, hold }) => {
  // A subscriber that unsubscribed leaves nothing behind.
  const output = stores(instance());

  await tracking();

  const subscriptions = (count: number) => {
    for (let i = 0; i < count; i++) output.t.subscribe(() => {})();
  };

  subscriptions(10_000);
  bounded('JS heap held per subscription to the t store, after it ended, over 100,000', 'B/subscription', await hold(subscriptions, 100_000), 1);

  // An instance wrapped, tracked and dropped leaves nothing behind, its
  // effect root included. The memo's table keeps the capacity the most
  // entries it held between two collections asked of it, so a first run of
  // twice as many sets that.
  const instances = async (count: number) => {
    for (let i = 0; i < count; i++) {
      stores(instance());
      await tracking();
    }
    flushSync();
  };

  await instances(10_000);
  bounded('JS heap held per instance wrapped, tracked and dropped, over 5,000', 'B/instance', await hold(instances, 5_000), 4);

  // The output stays reachable through the last read.
  if (output.locale.get() !== 'en') throw new Error('The output no longer reads the instance.');
};

export default measure;
