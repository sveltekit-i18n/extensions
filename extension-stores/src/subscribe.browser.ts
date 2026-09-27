import { untrack } from 'svelte';
import { toStore } from 'svelte/store';
import type { Readable } from 'svelte/store';

// A restarted client `toStore` emits only if its source differs from the value
// it was built with, so each subscription gets a store built from the current
// one — untracked, since building it reads the source in the caller's reaction.
export const fromInstance = <S extends Readable<V>, V>(store: S, get: () => V): S => ({
  ...store,
  subscribe: (run, invalidate) => untrack(() => toStore(get).subscribe(run, invalidate)),
});
