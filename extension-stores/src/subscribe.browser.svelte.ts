import { untrack } from 'svelte';
import { readable } from 'svelte/store';
import type { Readable } from 'svelte/store';

// A subscription starts with the instance's current value, and tracks it from
// an effect root of its own. The root is made in a microtask, where no effect
// is active: one made under the subscriber's effect, as `toStore` makes it, is
// only detached when that effect re-runs or ends, and stops being flushed.
export const fromInstance = <S extends Readable<V>, V>(store: S, get: () => V): S => ({
  ...store,
  subscribe: readable<V>(undefined, (set) => {
    const current = untrack(get);
    let stop: (() => void) | undefined;
    let stopped = false;
    let tracked = false;

    set(current);

    queueMicrotask(() => {
      if (stopped) return;

      // The first run can hand a change on, and its subscriber can leave there.
      const destroy = $effect.root(() => {
        $effect.pre(() => {
          const value = get();

          if (tracked || !Object.is(value, current)) set(value);

          tracked = true;
        });
      });

      if (stopped) destroy();
      else stop = destroy;
    });

    return () => {
      stopped = true;
      stop?.();
    };
  }).subscribe,
});
