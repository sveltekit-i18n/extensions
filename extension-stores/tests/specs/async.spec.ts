// @vitest-environment happy-dom
import { I18n } from '@sveltekit-i18n/base';
import type { Config } from '@sveltekit-i18n/base';
import { flushSync, mount, unmount } from 'svelte';
import { expect, it } from 'vitest';

import stores from '../../src';
import type { Output } from '../../src';
import Await from '../components/Await.svelte';

const CONFIG: Config.T = {
  initLocale: 'en',
  parser: {
    parse: (text, _params, _locale, key) => text ?? key,
  },
  log: {
    level: 'error',
  },
  translations: {
    en: { common: { hi: 'Hello!' } },
    cs: { common: { hi: 'Ahoj!' } },
    de: { common: { hi: 'Hallo!' } },
  },
};

const later = (microtasks: number, run: () => void) => {
  if (microtasks === 0) run();
  else queueMicrotask(() => { later(microtasks - 1, run); });
};

// A task queued after the one `first` resolves in runs once every microtask
// its resolution queued has.
const nextTask = () => new Promise<void>((done) => { setTimeout(done); });

// Under `experimental.async`, Svelte 5.56 leaves the context an `await`
// restored active until a microtask it queues: one that runs before it runs
// inside the component's effect.
it('follows the instance when the extension ran while an `await` held a component\'s context', async () => {
  for (let microtasks = 0; microtasks < 4; microtasks += 1) {
    const i18n = new I18n(CONFIG);
    let output: Output | undefined;
    const first = () => new Promise<number>((resolve) => {
      setTimeout(() => {
        resolve(1);
        later(microtasks, () => { output = stores(i18n); });
      });
    });
    const target = document.createElement('div');
    const component = mount(Await, { target, props: { first } });

    await nextTask();
    flushSync();
    expect([target.textContent, output]).toEqual(['2', expect.anything()]);

    // The change is pending when the component goes.
    void i18n.setLocale('de');
    void unmount(component);
    flushSync();

    const values: unknown[] = [];
    const unsubscribe = output!.locale.subscribe((value) => {
      values.push(value);
    });

    await output!.setLocale('cs');
    flushSync();

    expect(values).toEqual(['de', 'cs']);
    unsubscribe();
  }
});
