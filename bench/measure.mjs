// Measures one project of the benchmark against one built tree, in a process
// of its own, and writes its rows as JSON. `run.mjs` starts it; nothing else
// should. It resolves nothing from the repository root, which has no install:
// the tools, the core and `svelte` come from the install of the package it is
// run from, and the extension and its dependencies from the tree it measures.
//
//   --project bundle|sizes|counts|times|heap
//                      what to do: `bundle` compiles the package's
//                      `bench/<project>.ts` modules against the tree into
//                      `--bundles`, and the last three run them; heap under
//                      `--expose-gc --max-opt=0`, as run.mjs starts it
//   --tree <dir>       the package root measured: its `dist/`
//   --bundles <dir>    where the tree's modules are bundled
//   --out <file>       where the rows go
//
// A module named `<project>.server.ts` is compiled as a server render
// compiles it, any other as a browser does. It exports a function of the
// `Bench` that `bench.d.ts` declares, which records its rows.
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';

/**
 * @typedef {'count' | 'size' | 'time' | 'heap'} Kind
 * @typedef {{ id: string; kind: Kind; unit: string; value: number; most?: number }} Row
 * @typedef {'client' | 'server'} Generate
 */

const PROJECTS = ['bundle', 'sizes', 'counts', 'times', 'heap'];

const { values: args } = parseArgs({
  options: {
    project: { type: 'string' },
    tree: { type: 'string' },
    bundles: { type: 'string' },
    out: { type: 'string' },
  },
});

if (!args.tree || !args.bundles || !args.out || !PROJECTS.includes(args.project ?? '')) throw new Error(`Usage: measure.mjs --project ${PROJECTS.join('|')} --tree <dir> --bundles <dir> --out <file>`);

const ROOT = process.cwd();
// The bundler reports the paths it reads with their links resolved.
const tree = realpathSync.native(resolve(args.tree));
const bundles = resolve(args.bundles);
const require = createRequire(join(ROOT, 'package.json'));

/** @type {(dir: string) => { name: string; exports: Record<string, Record<string, string>>; peerDependencies?: Record<string, string> }} */
const manifest = (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
const pkg = manifest(ROOT);
// What an app brings: one copy of each, this package's, whichever tree
// imports it, or two `svelte` runtimes could not track each other.
const peers = Object.keys(pkg.peerDependencies ?? {});
/** @type {(source: string) => boolean} */
const isPeer = (source) => peers.some((peer) => source === peer || source.startsWith(`${peer}/`));

/** @type {Row[]} */
const rows = [];

// The bounds the rows went over, which fail the project once they are
// written, so the report shows the value that failed.
/** @type {string[]} */
const failures = [];

/** @type {(values: number[]) => number} */
const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1];

/**
 * The bundler vite runs on, and the `svelte` compiler of the install this
 * runs from, which compiles for the runtime of that install.
 */
const tools = async () => {
  const { rolldown } = await import(pathToFileURL(createRequire(require.resolve('vite')).resolve('rolldown')).href);
  const compiler = await import(pathToFileURL(require.resolve('svelte/compiler')).href);

  return { rolldown, svelte: compiler.compileModule ? compiler : compiler.default };
};

/**
 * A bundle of `input`, minified when the browser loads it, with the
 * components and the rune modules compiled for `generate`: the core and the
 * extensions ship them uncompiled. The extension resolves to the tree's
 * build, a peer to this package's install, and anything else as the module
 * importing it resolves it.
 *
 * @type {(input: string, options: { generate: Generate; external?: (source: string, importer?: string) => boolean; minify?: boolean }) => Promise<{ output: [{ code: string }]; write: (options: object) => Promise<unknown> }>}
 */
const bundle = async (input, { generate, external = () => false, minify = false }) => {
  const { rolldown, svelte } = await tools();
  const self = join(tree, manifest(tree).exports['.'].default);
  const build = await rolldown({
    input,
    platform: generate === 'client' && minify ? 'browser' : 'node',
    resolve: { conditionNames: [...(generate === 'client' ? ['browser'] : ['node']), 'production', 'import', 'module', 'default'] },
    logLevel: 'warn',
    plugins: [{
      name: 'subject',
      resolveId: {
        order: 'pre',
        /** @type {(this: { resolve: Function }, source: string, importer?: string) => Promise<unknown>} */
        async handler(source, importer) {
          if (source === pkg.name) return self;
          if (external(source, importer)) return { id: source, external: true };
          if (isPeer(source)) return this.resolve(source, join(ROOT, 'package.json'), { skipSelf: true });

          return null;
        },
      },
    }, {
      name: 'svelte',
      transform: {
        filter: { id: /\.svelte(\.js)?$/ },
        /** @type {(code: string, id: string) => { code: string; map: unknown }} */
        handler(code, id) {
          const options = { filename: id, generate, dev: false };

          return id.endsWith('.svelte') ? svelte.compile(code, options).js : svelte.compileModule(code, options).js;
        },
      },
    }],
  });

  return {
    output: (await build.generate({ format: 'esm', minify })).output,
    write: (options) => build.write({ format: 'esm', ...options }),
  };
};

/** The package's module of a project, and the target it is compiled for. */
const moduleOf = (/** @type {string} */ project) => {
  for (const [suffix, generate] of /** @type {const} */ ([['ts', 'client'], ['server.ts', 'server']])) {
    const file = join(ROOT, 'bench', `${project}.${suffix}`);

    if (existsSync(file)) return { file, generate };
  }

  return undefined;
};

if (args.project === 'bundle') {
  mkdirSync(bundles, { recursive: true });

  for (const project of ['counts', 'times', 'heap']) {
    const module = moduleOf(project);

    if (!module) continue;

    // What the module imports besides the extension and its peers — Node's
    // modules, `typescript` — loads from this package's install, next to
    // which the bundle lands.
    const benched = join(ROOT, 'bench', sep);
    const { write } = await bundle(module.file, {
      generate: module.generate,
      external: (source, importer) => importer?.startsWith(benched) === true && source !== pkg.name && !isPeer(source) && !source.startsWith('.'),
    });

    await write({ file: join(bundles, `${project}.mjs`) });
  }
} else if (args.project === 'sizes') {
  // The extension as a browser bundle of an app imports it, minified, its
  // dependencies included; the core and `svelte` are the app's.
  const entry = join(bundles, 'entry.js');

  mkdirSync(bundles, { recursive: true });
  writeFileSync(entry, `export * from ${JSON.stringify(pkg.name)};\nexport { default } from ${JSON.stringify(pkg.name)};\n`);

  const { output: [{ code }] } = await bundle(entry, { generate: 'client', minify: true, external: isPeer });

  rows.push({ id: 'browser bundle, minified', kind: 'size', unit: 'B', value: Buffer.byteLength(code) });
  rows.push({ id: 'browser bundle, minified and gzipped', kind: 'size', unit: 'B', value: gzipSync(code).length });
} else {
  const file = join(bundles, `${args.project}.mjs`);

  /**
   * The median duration of `fn` in milliseconds per call, over `samples`
   * rounds of `inner` calls each, after three rounds that warm up. `fn`
   * receives the index of the call, counted across every round, warm-up
   * included.
   *
   * @type {(fn: (index: number) => void, options?: { inner?: number; samples?: number }) => number}
   */
  const time = (fn, { inner = 1, samples = 15 } = {}) => {
    let index = 0;

    for (let i = 0; i < 3 * inner; i++) fn(index++);

    /** @type {number[]} */
    const durations = [];

    for (let i = 0; i < samples; i++) {
      const start = performance.now();

      for (let j = 0; j < inner; j++) fn(index++);
      durations.push((performance.now() - start) / inner);
    }

    return median(durations);
  };

  /**
   * `time` for an asynchronous `fn`, called and awaited one at a time.
   *
   * @type {(fn: (index: number) => Promise<unknown>, options?: { inner?: number; samples?: number }) => Promise<number>}
   */
  const timeAsync = async (fn, { inner = 1, samples = 15 } = {}) => {
    let index = 0;

    for (let i = 0; i < 3 * inner; i++) await fn(index++);

    /** @type {number[]} */
    const durations = [];

    for (let i = 0; i < samples; i++) {
      const start = performance.now();

      for (let j = 0; j < inner; j++) await fn(index++);
      durations.push((performance.now() - start) / inner);
    }

    return median(durations);
  };

  const gc = /** @type {(() => void) | undefined} */ (globalThis.gc);

  if (args.project === 'heap' && typeof gc !== 'function') throw new Error('The heap project runs under --expose-gc: start it through run.mjs.');

  // Nothing writes to a stream between two reads of the heap: the first write
  // to one allocates its state, so each is written to here.
  process.stdout.write('');
  process.stderr.write('');

  // Typed, so a read allocates no number of its own.
  const heap = new Float64Array(4);
  /** @type {(point: number) => void} */
  const read = (point) => {
    /** @type {() => void} */ (gc)();
    /** @type {() => void} */ (gc)();
    heap[point] = process.memoryUsage().heapUsed;
  };

  // The first read of the process allocates, so it counts for nothing.
  if (args.project === 'heap') read(0);

  const { default: measure } = await import(pathToFileURL(file).href);

  await measure({
    root: ROOT,
    tree,
    /** @type {(id: string, kind: Kind, unit: string, value: number) => void} */
    record: (id, kind, unit, value) => {
      rows.push({ id, kind, unit, value });
    },
    /** @type {(id: string, unit: string, value: number, most: number) => void} */
    bounded: (id, unit, value, most) => {
      rows.push({ id, kind: 'heap', unit, value, most });
      if (!(value < most)) failures.push(`${id}: ${value} ${unit}, where it must stay under ${most}.`);
    },
    time,
    timeAsync,
    /** @type {(run: (count: number) => unknown, count: number) => Promise<number>} */
    hold: async (run, count) => {
      read(0);
      for (let round = 1; round <= 3; round++) {
        await run(count);
        read(round);
      }

      return median([1, 2, 3].map((round) => (heap[round] - heap[round - 1]) / count));
    },
  });
}

writeFileSync(args.out, JSON.stringify(rows));

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
