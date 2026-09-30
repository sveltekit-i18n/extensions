import { describe, expect, it } from 'vitest';

import { compile, diagnostics } from '../program';

describe('`<T>` under `exactOptionalPropertyTypes`', () => {
  it('takes an explicit `undefined` for an optional prop, as `t()` does for an optional param', () => {
    const { program } = compile('tests/types/exact.ts', { exactOptionalPropertyTypes: true });

    expect(program.getCompilerOptions().exactOptionalPropertyTypes).toBe(true);
    expect(diagnostics(program)).toEqual([]);
  }, 60_000);
});
