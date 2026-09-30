import { flushSync } from 'svelte';

/** Runs `read` in an effect, as a template would, and records what each run returned. */
export const track = <T>(read: () => T) => {
  const values: T[] = [];
  const destroy = $effect.root(() => {
    $effect(() => {
      values.push(read());
    });
  });

  flushSync();

  return { values, destroy };
};
