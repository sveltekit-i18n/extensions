import type { Readable } from 'svelte/store';

// The client build of `toStore` tracks its source.
export const fromInstance = <S extends Readable<unknown>>(store: S): S => store;
