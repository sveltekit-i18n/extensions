import { flushSync } from 'svelte';
import type { Readable } from 'svelte/store';

// Subscribes to `store` from inside an effect that re-runs whenever `rerun`
// changes, as a component's store subscription does.
export const subscribeInEffect = <T>(store: Readable<T>) => {
  const values: T[] = [];
  let runs = $state(0);
  const destroy = $effect.root(() => {
    $effect(() => {
      void runs;

      return store.subscribe((value) => {
        values.push(value);
      });
    });
  });

  return {
    values,
    rerun: () => {
      runs += 1;
    },
    destroy,
  };
};

// Runs `run` inside an effect, as a component's script does, and destroys the
// effect before handing back what `run` returned.
export const inDestroyedEffect = <T>(run: () => T): T => {
  let result!: T;
  const destroy = $effect.root(() => {
    $effect.pre(() => {
      result = run();
    });
  });

  flushSync();
  destroy();

  return result;
};

// A reactive value that counts how often it is read.
export const countedState = <T>(initial: T) => {
  let value = $state(initial);
  let reads = 0;

  return {
    get: () => {
      reads += 1;

      return value;
    },
    set: (next: T) => {
      value = next;
    },
    reads: () => reads,
  };
};
