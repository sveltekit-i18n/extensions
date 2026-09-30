import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { compile, diagnostics } from '../program';

/**
 * The relations the checker caches for each call of the probe, by its text. A
 * count, not a duration: one compiler version counts the same on every
 * machine. A union TypeScript tries member by member caches a relation per
 * member, so the count grows with the schema. It counts the comparisons,
 * not the contextual typing of a literal, which still walks the union.
 */
const measure = () => {
  const { program, source: file } = compile('tests/types/cost.ts');
  const checker = program.getTypeChecker();
  const relations = () => Object.values(program.getRelationCacheSizes()).reduce((sum, size) => sum + size, 0);
  const counts: Record<string, number> = {};

  // In source order, before anything else checks the file.
  for (const statement of file.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue;

    const before = relations();

    checker.getResolvedSignature(statement.expression);
    counts[statement.expression.getText(file)] = relations() - before;
  }

  return { counts, diagnostics: diagnostics(program) };
};

describe('the cost of a `<T>` usage', () => {
  let probe: ReturnType<typeof measure> | undefined;
  const measured = () => (probe ??= measure());

  it('compiles the probe', () => {
    expect(measured().diagnostics).toEqual([]);
  }, 60_000);

  it('does not grow with the size of the schema', () => {
    const { counts } = measured();

    expect(counts["controlLarge({ key: 'ns.r99', params: { name: 'x' } })"]).toBeGreaterThan(5 * counts["controlSmall({ key: 'ns.r9', params: { name: 'x' } })"]);

    for (const [small, large] of [
      ["renderSmall({ key: 'ns.r9', params: { name: 'x' } })", "renderLarge({ key: 'ns.r99', params: { name: 'x' } })"],
      ["renderSmall({ key: 'ns.v9' })", "renderLarge({ key: 'ns.v99' })"],
      ["renderSmall({ key: 'ns.v8', args: [{ strict: true }] })", "renderLarge({ key: 'ns.v98', args: [{ strict: true }] })"],
      ["renderStrictSmall({ key: 'ns.r9', params: { name: 'x' } })", "renderStrictLarge({ key: 'ns.r99', params: { name: 'x' } })"],
    ]) {
      expect(counts[large], large).toBeLessThan(2 * counts[small]);
    }
  }, 60_000);
});
