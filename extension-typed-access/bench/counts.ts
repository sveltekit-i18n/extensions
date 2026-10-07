import { join, resolve } from 'node:path';

import ts from 'typescript';

import type { Measure } from '../../bench/bench.js';

const SIZES = [1_000, 10_000];

/** The key shapes, each a list of namespaces and the number of keys in each; `''` holds keys of one segment. */
const SHAPES: Record<string, (size: number) => [string, number][]> = {
  'flat keys': (size) => [['', size]],
  'namespaces of 10 keys': (size) => Array.from({ length: size / 10 }, (_, i) => [`n${i}`, 10]),
  'one namespace': (size) => [['ns', size]],
};

const n = (value: number) => value.toLocaleString('en-US');

/** The keys of a shape, namespace by namespace. */
const keysOf = (namespaces: [string, number][]) => namespaces.flatMap(([namespace, size]) => Array.from({ length: size }, (_, i) => (namespace ? `${namespace}.k${i}` : `k${i}`)));

/**
 * The schema of `keys`, and the registration `@sveltekit-i18n/typegen` writes
 * for it when `generated`: its levels, which the extension reads instead of
 * grouping the keys.
 */
const schemaOf = (namespaces: [string, number][], generated: boolean) => {
  const keys = keysOf(namespaces);
  const schema = `interface TranslationSchema {\n${keys.map((key) => `  '${key}': never;`).join('\n')}\n}`;

  if (!generated) return schema;

  const nested = namespaces.filter(([namespace]) => namespace);
  const root = namespaces.find(([namespace]) => !namespace);
  const leaves = (prefix: string, size: number) => Array.from({ length: size }, (_, i) => `'k${i}': { key: '${prefix}k${i}' };`).join(' ');

  return [
    schema,
    'declare namespace SvelteKitI18n {',
    '  interface Register {',
    '    schema: TranslationSchema;',
    `    tree: { keys: ${keys.map((key) => `'${key}'`).join(' | ')}; patterns: never; next: Typegen.Bench.Level0 };`,
    '  }',
    '  namespace Typegen.Bench {',
    `    interface Level0 { ${root ? leaves('', root[1]) : nested.map(([namespace], i) => `'${namespace}': { next: Level${i + 1} };`).join(' ')} }`,
    ...nested.map(([namespace, size], i) => `    interface Level${i + 1} { ${leaves(`${namespace}.`, size)} }`),
    '  }',
    '}',
  ].join('\n');
};

/**
 * The instantiations of each call through the tree of an instance over a
 * schema of `shape` and `size`, as the checker meets them in source order: the
 * first reads the tree, the next one costs its own path. A count, not a
 * duration: one compiler version counts the same on every machine. The probe
 * exists only in memory, beside the core of this package's install, and reads
 * the extension's declarations from the tree measured.
 */
const measure: Measure = ({ root, tree, record }) => {
  const probe = join(root, 'bench', 'probe.ts');
  const options: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  };
  const base = ts.resolveModuleName('@sveltekit-i18n/base', probe, options, ts.sys).resolvedModule?.resolvedFileName;

  if (!base) throw new Error('The core is not installed beside the benchmark.');

  // The tree's declarations import the core: this install's, as the probe does.
  options.paths = {
    '@sveltekit-i18n/base': [base],
    '@sveltekit-i18n/extension-typed-access': [join(tree, 'dist/index.d.ts')],
  };

  for (const [shape, namespacesOf] of Object.entries(SHAPES)) {
    for (const size of SIZES) {
      const namespaces = namespacesOf(size);
      const keys = keysOf(namespaces);
      // The first key, and the last, which shares no level but the root with it.
      const calls = [keys[0], keys.at(-1)!];

      for (const generated of [false, true]) {
        const schema = join(root, 'bench', 'schema.d.ts');
        const files = new Map([
          [schema, schemaOf(namespaces, generated)],
          [probe, [
            "import I18n from '@sveltekit-i18n/base';",
            "import typedAccess from '@sveltekit-i18n/extension-typed-access';",
            'const parser = { parse: (value: any) => value };',
            `const i18n = new I18n({ parser, ${generated ? '' : 'schema: {} as TranslationSchema, '}extensions: [typedAccess] });`,
            ...calls.map((key) => `i18n.t.${key}();`),
          ].join('\n')],
        ]);
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
        const file = program.getSourceFile(probe);

        if (!file) throw new Error('The probe is not in its program.');
        const counts: number[] = [];

        // In source order, before anything else checks the file.
        for (const statement of file.statements) {
          if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue;

          const before = program.getInstantiationCount();

          checker.getResolvedSignature(statement.expression);
          counts.push(program.getInstantiationCount() - before);
        }

        const diagnostics = [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)];

        if (diagnostics.length) throw new Error(`The probe of ${shape}, ${n(size)} keys, does not compile: ${diagnostics.map(({ messageText }) => ts.flattenDiagnosticMessageText(messageText, '\n')).join('\n')}`);

        const how = generated ? 'the levels typegen registers' : 'keys grouped by the extension';

        record(`instantiations, the first call through the tree (${shape}, ${n(size)} keys, ${how})`, 'count', 'instantiations', counts[0]);
        record(`instantiations, a later call (${shape}, ${n(size)} keys, ${how})`, 'count', 'instantiations', counts[1]);
      }
    }
  }
};

export default measure;
