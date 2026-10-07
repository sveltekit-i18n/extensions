import stores from '@sveltekit-i18n/extension-stores';
import { flushSync } from 'svelte';

import type { Measure } from '../../bench/bench.js';

import { instance, tracking } from './data.js';

const SUBSCRIBERS = 100;

const measure: Measure = async ({ record, time, timeAsync }) => {
  const micro = (fn: (index: number) => unknown, inner = 2_000) => 1_000 * time(fn, { inner });

  // Each call wraps an instance of its own, made beforehand: the core's
  // constructor is not measured.
  const instances = Array.from({ length: 18 * 200 }, instance);

  record('stores(instance), a new instance', 'time', 'µs', micro((index) => stores(instances[index]), 200));

  const output = stores(instance());

  await tracking();
  record('subscribe and unsubscribe, the t store', 'time', 'µs', micro(() => { output.t.subscribe(() => {})(); }));
  record('get(), the t store', 'time', 'µs', micro(() => output.t.get()));

  let calls = 0;

  for (let i = 0; i < SUBSCRIBERS; i++) {
    output.t.subscribe(() => {
      calls += 1;
    });
  }

  const before = calls;
  const locales = ['cs', 'en'];

  record(`setLocale() reaching ${SUBSCRIBERS} subscribers of the t store`, 'time', 'ms', await timeAsync(async (index) => {
    await output.setLocale(locales[index % 2]);
    flushSync();
  }));

  // Every switch reached every subscriber, so none was timed short of it.
  if (calls - before !== SUBSCRIBERS * 18) throw new Error(`${SUBSCRIBERS} subscribers were called ${calls - before} times over 18 switches.`);
};

export default measure;
