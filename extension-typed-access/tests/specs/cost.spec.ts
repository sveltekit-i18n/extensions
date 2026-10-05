import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PROBE = resolve(ROOT, 'tests/types/cost');

/**
 * A registration as `@sveltekit-i18n/typegen` writes it, of namespaces one
 * level deep, and with `cms` open where `pattern` says typegen could not read
 * it.
 */
const schemaOf = (namespaces: Record<string, number>, pattern: boolean): string => {
  const keys = Object.entries(namespaces).flatMap(([namespace, size]) => Array.from({ length: size }, (_, i) => `${namespace}.k${i}`));
  const names = Object.keys(namespaces);

  return [
    `interface TranslationSchema {\n${keys.map((key) => `  '${key}': never;`).join('\n')}${pattern ? '\n  [key: `cms.${string}`]: any;' : ''}\n}`,
    'declare namespace SvelteKitI18n {',
    '  interface Register {',
    '    schema: TranslationSchema;',
    `    tree: { keys: ${keys.map((key) => `'${key}'`).join(' | ')}; patterns: ${pattern ? '`cms.${string}`' : 'never'}; next: Typegen.Probe.Level0 };`,
    '  }',
    '  namespace Typegen.Probe {',
    `    interface Level0 { ${pattern ? "'cms': { open: true }; " : ''}${names.map((namespace, i) => `'${namespace}': { next: Level${i + 1} };`).join(' ')} }`,
    ...names.map((namespace, i) => `    interface Level${i + 1} { ${keys.filter((key) => key.startsWith(`${namespace}.`)).map((key) => `'${key.slice(namespace.length + 1)}': { key: '${key}' };`).join(' ')} }`),
    '  }',
    '}',
  ].join('\n');
};

const CALLS = ['warm.k0', 'small.k1', 'large.k1'];

// `grouped` states a key the tree was not built from, so its keys are grouped here.
const SOURCE = [
  "import I18n from '@sveltekit-i18n/base';",
  "import typedAccess from '@sveltekit-i18n/extension-typed-access';",
  'const parser = { parse: (value: any) => value };',
  'const generated = new I18n({ parser, extensions: [typedAccess] });',
  "const grouped = new I18n({ parser, schema: {} as TranslationSchema & { 'zz.extra': never }, extensions: [typedAccess] });",
  ...['generated', 'grouped'].flatMap((instance) => CALLS.map((key) => `${instance}.t.${key}();`)),
  'export const level = generated.t.small;',
].join('\n');

/**
 * What each call of the probe costs in instantiations, by its text, against
 * the build, with `large` holding `size` keys. A count, not a duration: one
 * compiler version counts the same on every machine. The probe exists only in
 * memory.
 */
const measure = (size: number, pattern = false) => {
  const files = new Map([
    [resolve(PROBE, 'schema.d.ts'), schemaOf({ warm: 1, small: 10, large: size }, pattern)],
    [resolve(PROBE, 'probe.ts'), SOURCE],
  ]);
  const options: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    strict: true,
    noEmit: true,
    types: [],
    paths: { '@sveltekit-i18n/extension-typed-access': [resolve(ROOT, 'dist/index.d.ts')] },
  };
  const host = ts.createCompilerHost(options);
  const [fileExists, readFile, getSourceFile] = [host.fileExists.bind(host), host.readFile.bind(host), host.getSourceFile.bind(host)];

  host.fileExists = (name) => files.has(resolve(name)) || fileExists(name);
  host.readFile = (name) => files.get(resolve(name)) ?? readFile(name);
  host.getSourceFile = (name, language, ...rest) => {
    const text = files.get(resolve(name));

    return text === undefined ? getSourceFile(name, language, ...rest) : ts.createSourceFile(name, text, language);
  };

  const program = ts.createProgram({ rootNames: [...files.keys()], options, host });
  const checker = program.getTypeChecker();
  const file = program.getSourceFile(resolve(PROBE, 'probe.ts'))!;
  const counts: Record<string, number> = {};

  // In source order, before anything else checks the file: each call pays for
  // what no earlier call instantiated, the first one through an instance for
  // reading its tree.
  for (const statement of file.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue;

    const before = program.getInstantiationCount();

    checker.getResolvedSignature(statement.expression);
    counts[statement.expression.getText(file)] = program.getInstantiationCount() - before;
  }

  const [declaration] = file.statements.filter(ts.isVariableStatement).at(-1)!.declarationList.declarations;
  const level = checker.typeToString(checker.getTypeAtLocation(declaration.name), undefined, ts.TypeFormatFlags.NoTruncation);
  const diagnostics = ts.getPreEmitDiagnostics(program).map(({ messageText }) => ts.flattenDiagnosticMessageText(messageText, '\n'));

  return { counts, level, diagnostics };
};

// The probe reads the build, so this runs after `npm run build`, as `npm test` does.
describe('the tree typegen registers', () => {
  type Probe = ReturnType<typeof measure>;

  let probes: Record<'closed' | 'open', [Probe, Probe]> | undefined;
  const measured = () => (probes ??= {
    closed: [measure(1000), measure(4000)],
    open: [measure(1000, true), measure(4000, true)],
  });

  it('compiles the probe', () => {
    for (const probe of Object.values(measured()).flat()) expect(probe.diagnostics).toEqual([]);
  }, 120_000);

  it('costs a call what its own path does, whatever the size of the schema', () => {
    const [{ counts: before }, { counts: after }] = measured().closed;

    // The control: grouping the keys here grows with the schema.
    expect(after['grouped.t.warm.k0()']).toBeGreaterThan(3 * before['grouped.t.warm.k0()']);

    // The first call reads the instance's tree, and with it the check that the
    // levels were built from its keys.
    expect(after['generated.t.warm.k0()']).toBeLessThan(1.1 * before['generated.t.warm.k0()']);
    expect(after['generated.t.small.k1()']).toBeLessThan(1.1 * before['generated.t.small.k1()']);
    // A level costs its own segments, once.
    expect(after['generated.t.large.k1()']).toBeLessThan(5 * before['generated.t.large.k1()']);
  }, 120_000);

  it('reads the literal keys once where a namespace is open', () => {
    const [{ counts: before }, { counts: after }] = measured().open;

    expect(after['generated.t.warm.k0()']).toBeLessThan(5 * before['generated.t.warm.k0()']);
    expect(after['generated.t.small.k1()']).toBeLessThan(1.1 * before['generated.t.small.k1()']);
  }, 120_000);

  // With a namespace open, grouping the keys here meets every bound above:
  // only the level's name tells that the levels were read.
  it.each(['closed', 'open'] as const)('names a level by its interface and the keys by the schema, %s', (probe) => {
    const [{ level }] = measured()[probe];

    expect(level).toContain('{ next: Level2; }');
    expect(level).toContain('keyof TranslationSchema');
    expect(level.length).toBeLessThan(200);
  }, 120_000);
});
