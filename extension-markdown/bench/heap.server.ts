import type { Measure } from '../../bench/bench.js';

import { check, setup } from './data.js';

/** What the extension holds. A pointer kept per render reads 8 B or more. */
const measure: Measure = async ({ bounded, hold }) => {
  check();

  const { ssr } = setup();
  const renders = (count: number) => {
    for (let i = 0; i < count; i++) ssr('inline nodes and a payload');
  };

  renders(1_000);
  bounded('JS heap held per server render of <T>, over 10,000 renders', 'B/render', await hold(renders, 10_000), 4);
};

export default measure;
