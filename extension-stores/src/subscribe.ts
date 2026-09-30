import type { Readable } from 'svelte/store';

// The server build of `toStore` snapshots its source once, when the extension
// runs — before any load has landed — and never emits again. A subscription
// therefore takes its value from the instance.
const fromInstance = <S extends Readable<V>, V>(store: S, get: () => V): S => ({
  ...store,
  subscribe: (run) => {
    run(get());

    return () => {};
  },
});

export const tracker = () => fromInstance;
