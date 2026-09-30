import { untrack } from 'svelte';
import { writable } from 'svelte/store';
import type { Readable } from 'svelte/store';

// One effect root per instance, made in a microtask once no effect is active: a
// root made under an effect (a component's, or one an `await` restored under
// `experimental.async`) is detached when that effect ends and can stop being
// flushed. Made before the app mounts, it re-runs ahead of the templates that
// read the stores, and runs its effects in the order the stores are made.
export const tracker = () => {
  const trackers: (() => void)[] = [];
  const track = () => {
    if ($effect.tracking()) {
      queueMicrotask(track);

      return;
    }

    $effect.root(() => {
      for (const run of trackers) $effect.pre(run);
    });
  };

  queueMicrotask(track);

  return <S extends Readable<V>, V>(store: S, get: () => V): S => {
    let value = untrack(get);
    const emit = (next: V) => {
      if (Object.is(next, value)) return;

      value = next;
      untrack(() => { set(next); });
    };
    const { subscribe, set } = writable<V>(value, () => {
      emit(untrack(get));
    });

    trackers.push(() => {
      emit(get());
    });

    return { ...store, subscribe };
  };
};
