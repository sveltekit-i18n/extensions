import type { Measure } from '../../bench/bench.js';

import { check, MESSAGES, setup } from './data.js';

/** A server render of `<i18n.T>`, per kind of message: microseconds per render. */
const measure: Measure = ({ record, time }) => {
  check();

  const { reports, ssr } = setup();

  for (const kind of Object.keys(MESSAGES)) {
    record(`server render of <T>, ${kind}`, 'time', 'µs', 1_000 * time(() => ssr(kind), { inner: 200 }));
    reports.length = 0;
  }
};

export default measure;
