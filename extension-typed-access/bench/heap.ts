import typedAccess from '@sveltekit-i18n/extension-typed-access';

import type { Measure } from '../../bench/bench.js';

type Node = ((...params: unknown[]) => unknown) & { readonly [segment: string]: Node };

const t = (key: string) => key;
const wrap = typedAccess as unknown as (instance: { t: typeof t }) => { t: Node };

/** What the extension holds. A pointer kept per call or per instance reads 8 B or more. */
const measure: Measure = async ({ bounded, hold }) => {
  // A member path builds a node per segment, and keeps none of them.
  const output = wrap({ t });
  const calls = (count: number) => {
    for (let i = 0; i < count; i++) output.t.a.b.c.d.e.f();
  };

  calls(10_000);
  bounded('JS heap held per call of a member path of 6 segments, over 100,000 calls', 'B/call', await hold(calls, 100_000), 1);

  // An instance wrapped and dropped leaves nothing in the extension's memo.
  // The memo's table keeps the capacity the most entries it held between two
  // collections asked of it, so a first run of twice as many sets that.
  const instances = (count: number) => {
    for (let i = 0; i < count; i++) wrap({ t });
  };

  instances(20_000);
  bounded('JS heap held per instance wrapped and dropped, over 10,000 instances', 'B/instance', await hold(instances, 10_000), 4);

  // The output stays reachable through the last read.
  if (output.t.a() !== 'a') throw new Error('The output no longer calls the instance.');
};

export default measure;
