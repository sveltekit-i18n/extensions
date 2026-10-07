import typedAccess from '@sveltekit-i18n/extension-typed-access';

import type { Measure } from '../../bench/bench.js';

/** A node of the tree, as an instance without a schema leaves it untyped. */
type Node = ((...params: unknown[]) => unknown) & { readonly [segment: string]: Node };

const t = (key: string) => key;
const wrap = typedAccess as unknown as (instance: { t: typeof t }) => { t: Node };

/**
 * What the extension adds to a call, over an instance whose `t` returns the
 * key: the core and its parser are not measured. Microseconds per call, each
 * call reading `t` off the output as a template does.
 */
const measure: Measure = ({ record, time }) => {
  const output = wrap({ t });
  const micro = (fn: () => unknown) => 1_000 * time(fn, { inner: 2_000 });

  // A path that reached anything but its key would read as fast as any.
  if (output.t.a.b.c.d.e.f() !== 'a.b.c.d.e.f') throw new Error('A member path does not call `t` with its key.');

  record('t(key) through the output, a key of 3 segments', 'time', 'µs', micro(() => output.t('a.b.c')));
  record('t.a(), a member path of 1 segment', 'time', 'µs', micro(() => output.t.a()));
  record('t.a.b.c(), a member path of 3 segments', 'time', 'µs', micro(() => output.t.a.b.c()));
  record('t.a.b.c.d.e.f(), a member path of 6 segments', 'time', 'µs', micro(() => output.t.a.b.c.d.e.f()));
  record('typedAccess(instance), a new instance', 'time', 'µs', micro(() => wrap({ t })));
};

export default measure;
