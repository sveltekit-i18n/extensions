// Runs the benchmark of the package it is started from: `npm run bench`
// measures that package, and `npm run bench -- --compare <dir>` measures it
// against the same package checked out at `<dir>` (master, in CI), printing a
// table of both. Node runs this file as it is, so it is plain JavaScript and
// imports nothing but Node's own modules: the repository root has no install.
//
//   --compare <dir>   the package root to measure against, installed
//   --samples <n>     processes per side for time and heap rows (default 11)
//   --report <file>   also writes the table, as Markdown, to <file>
//   --write           writes BENCH.md from this tree's rows
//
// Each tree is built by its own toolchain and ships its own dependencies; what
// an app brings — the core, `svelte` — and the tools come from this tree's
// install, so both trees run beside the same core.
//
// It exits with 1 when a project of this tree failed, and with 2 when only the
// comparison failed: a count grew, a row of the base is missing from this
// tree, or a project of the base failed short of its rows (a base over a heap
// bound is only reported). The `bench-accepted:<package>` label lets the
// second pass in CI.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { arch, constants, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/**
 * @typedef {'count' | 'size' | 'time' | 'heap'} Kind
 * @typedef {{ id: string; kind: Kind; unit: string; value: number; most?: number }} Row
 * @typedef {'master' | 'head'} Subject
 * @typedef {'build' | 'bundle' | 'sizes' | 'counts' | 'times' | 'heap'} Project
 * @typedef {{ kind: Kind; unit: string; values: number[]; most?: number }} Measured
 */

const MEASURE = join(dirname(fileURLToPath(import.meta.url)), 'measure.mjs');
/** @type {Kind[]} */
const KINDS = ['count', 'size', 'time', 'heap'];

// A time counts as changed only beyond the spread of both sides and by this
// share of master's median or more.
const THRESHOLD = 0.05;
// Heap counts as changed beyond the spread of both sides by this many bytes,
// whatever the share: what an extension holds is the same on every run, to a
// fraction of a byte.
const HEAP_FLOOR = 2;
// The heap project reads the heap after collecting it, and leaves every tier
// of V8's above its interpreter out, which would compile code between two reads.
/** @type {Record<Exclude<Project, 'build'>, string[]>} */
const FLAGS = { bundle: [], sizes: [], counts: [], times: [], heap: ['--expose-gc', '--max-opt=0'] };

const { values: args } = parseArgs({
  options: {
    compare: { type: 'string' },
    samples: { type: 'string', default: '11' },
    report: { type: 'string' },
    write: { type: 'boolean', default: false },
  },
});

const ROOT = process.cwd();

if (!existsSync(join(ROOT, 'bench'))) throw new Error(`${ROOT} has no bench/: run the benchmark from a package directory.`);

const samples = Number(args.samples);

if (!Number.isInteger(samples) || samples < 1) throw new Error(`--samples takes a positive integer, not ${args.samples}.`);

/** @type {(dir: string) => { name: string; version: string; dependencies?: Record<string, string>; peerDependencies?: Record<string, string> }} */
const manifest = (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
const pkg = manifest(ROOT);
const name = pkg.name.split('/').pop() ?? pkg.name;
const label = `bench-accepted:${name}`;
/** @type {Partial<Record<Subject, string>>} */
const trees = { head: ROOT };

// A package the base does not have yet is measured alone.
if (args.compare && existsSync(join(resolve(args.compare), 'package.json'))) {
  const master = resolve(args.compare);

  if (!existsSync(join(master, 'node_modules'))) throw new Error(`${master} has no install: run \`npm ci\` there first.`);

  trees.master = master;
}

const subjects = /** @type {Subject[]} */ (Object.keys(trees));
/** @type {Record<Subject, Set<Project>>} */
const failed = { master: new Set(), head: new Set() };
// The modules this tree measures with, by project: what neither has is not run.
/** @type {('counts' | 'times' | 'heap')[]} */
const modules = /** @type {const} */ (['counts', 'times', 'heap']).filter((project) => ['ts', 'server.ts'].some((suffix) => existsSync(join(ROOT, 'bench', `${project}.${suffix}`))));
// Under the package's install, where a run stopped short leaves nothing in
// the tree, one directory per run.
mkdirSync(join(ROOT, 'node_modules/.cache'), { recursive: true });

const OUT = mkdtempSync(join(ROOT, 'node_modules/.cache/bench-'));

process.on('exit', () => rmSync(OUT, { recursive: true, force: true }));

// A signal stops the run between two processes, so the directory goes too. A
// child the terminal stopped as well ends first, and one it did not finishes.
for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) process.on(signal, () => process.exit(128 + constants.signals[signal]));

/**
 * Hands the event loop a turn, which every signal received while a child ran
 * waits for.
 *
 * @type {() => Promise<void>}
 */
const settle = () => new Promise((done) => { setImmediate(done); });

// The build each tree ships, from its own toolchain. Under `npm run`, npm is
// the one that started this; otherwise the one on the path.
for (const subject of subjects) {
  const npm = process.env.npm_execpath;
  const { status } = npm
    ? spawnSync(process.execPath, [npm, 'run', 'build'], { cwd: trees[subject], stdio: ['ignore', 'inherit', 'inherit'] })
    : spawnSync('npm', ['run', 'build'], { cwd: trees[subject], stdio: ['ignore', 'inherit', 'inherit'], shell: platform() === 'win32' });

  if (status !== 0) failed[subject].add('build');
  await settle();
}

/**
 * Runs one project against one tree in a process of its own and reads back
 * its rows.
 *
 * @type {(subject: Subject, project: Exclude<Project, 'build'>, sample: number) => Promise<Row[]>}
 */
const run = async (subject, project, sample) => {
  if (failed[subject].has('build') || (project !== 'sizes' && project !== 'bundle' && failed[subject].has('bundle'))) return [];

  const out = join(OUT, `${subject}-${project}-${sample}.json`);
  const { status } = spawnSync(process.execPath, [...FLAGS[project], MEASURE, '--project', project, '--tree', /** @type {string} */ (trees[subject]), '--bundles', join(OUT, subject), '--out', out], {
    cwd: ROOT,
    stdio: ['ignore', 'inherit', 'inherit'],
    // Dates render alike on every machine, and the core and `svelte` run as
    // an app ships them.
    env: { ...process.env, NODE_ENV: 'production', TZ: 'UTC' },
  });

  // A project that wrote its rows and failed went over a bound, which the
  // rows name: that fails this tree, and the base only reports it.
  if (status !== 0 && (subject === 'head' || !existsSync(out))) failed[subject].add(project);
  await settle();

  return existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : [];
};

/** @type {Record<Subject, Map<string, Measured>>} */
const measured = { master: new Map(), head: new Map() };

/** @type {(subject: Subject, rows: Row[]) => void} */
const add = (subject, rows) => rows.forEach(({ id, kind, unit, value, most }) => {
  const entry = measured[subject].get(id) ?? { kind, unit, values: [], most };

  entry.values.push(value);
  measured[subject].set(id, entry);
});

// Each tree's modules are bundled once, so no measured process compiles
// anything. Counts and sizes are the same on every run, so one run of each
// side does.
for (const subject of subjects) {
  if (modules.length) await run(subject, 'bundle', 0);
  add(subject, await run(subject, 'sizes', 0));
  if (modules.includes('counts')) add(subject, await run(subject, 'counts', 0));
}

// Times and heap alternate between the sides, each sample in a fresh process,
// so a drift of the machine lands on both.
for (let sample = 0; sample < samples; sample++) {
  const order = sample % 2 ? [...subjects].reverse() : subjects;

  for (const project of /** @type {const} */ (['times', 'heap'])) {
    if (!modules.includes(project)) continue;

    for (const subject of order) add(subject, await run(subject, project, sample));
  }
}

/** @type {(values: number[]) => number} */
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;

  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * The spread of a row's samples: their range once a quarter of them, rounded
 * down, is dropped at each end. A process that shared the machine with a busy
 * neighbour lands at an end, so it cannot widen the spread and hide a change.
 *
 * @type {(values: number[]) => [number, number]}
 */
const spreadOf = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const dropped = sorted.length >> 2;

  return [sorted[dropped], sorted[sorted.length - 1 - dropped]];
};

/** @type {(kind: Kind) => boolean} */
const sampled = (kind) => kind === 'time' || kind === 'heap';

/** @type {(value: number, unit: string) => string} */
const format = (value, unit) => {
  if (unit === 'ms' || unit === 'µs') return `${value.toLocaleString('en-US', { maximumSignificantDigits: 3 })} ${unit}`;

  // A tenth of a byte, the noise of a heap row; a value that rounds to zero
  // reads without a sign.
  if (unit.startsWith('B/')) return `${value.toLocaleString('en-US', { maximumFractionDigits: 1, signDisplay: 'negative' })} ${unit}`;

  return `${Math.round(value).toLocaleString('en-US')} ${unit}`;
};

/** @type {(entry: Measured) => string} */
const spread = ({ values, unit }) => {
  const [low, high] = spreadOf(values).map((bound) => format(bound, unit));

  return values.length < 2 ? '' : low === high ? low : `${low} to ${high}`;
};

/** @typedef {{ id: string; kind: Kind; master?: Measured; head?: Measured; flag: string; delta: string }} Line */

/** @type {(id: string) => Line} */
const compare = (id) => {
  const master = measured.master.get(id);
  const head = measured.head.get(id);
  const kind = /** @type {Measured} */ (head ?? master).kind;

  if (!head) return { id, kind, master, flag: 'missing', delta: '' };

  if (!master) return { id, kind, head, flag: trees.master ? 'new' : '', delta: '' };

  const [from, to] = [median(master.values), median(head.values)];
  const change = from === 0 ? (to === 0 ? 0 : Infinity) : (to - from) / Math.abs(from);
  // A difference no figure shows, a heap row's tenths of a byte, is none.
  const delta = format(to - from, head.unit) === format(0, head.unit) ? '0' : `${to > from ? '+' : ''}${format(to - from, head.unit)}${Number.isFinite(change) && format(from, head.unit) !== format(0, head.unit) ? ` (${to > from ? '+' : ''}${(100 * change).toFixed(1)}%)` : ''}`;

  if (kind === 'count' || kind === 'size') {
    if (to > from) return { id, kind, master, head, delta, flag: kind === 'count' ? 'grew, fails' : 'grew, review' };

    return { id, kind, master, head, delta, flag: to < from ? 'shrank' : '' };
  }

  const [[masterLow, masterHigh], [headLow, headHigh]] = [spreadOf(master.values), spreadOf(head.values)];

  if (kind === 'heap') {
    const grew = headLow - masterHigh >= HEAP_FLOOR;
    const shrank = masterLow - headHigh >= HEAP_FLOOR;

    return { id, kind, master, head, delta, flag: grew ? 'grew, review' : shrank ? 'shrank' : '' };
  }

  const slower = headLow > masterHigh && change >= THRESHOLD;
  const faster = headHigh < masterLow && change <= -THRESHOLD;

  return { id, kind, master, head, delta, flag: slower ? 'slower, review' : faster ? 'faster' : '' };
};

const ids = [...new Set([...measured.head.keys(), ...measured.master.keys()])];
const lines = KINDS.flatMap((kind) => ids.map(compare).filter((line) => line.kind === kind));

const grew = lines.filter(({ flag }) => flag === 'grew, fails');
const missing = lines.filter(({ flag }) => flag === 'missing');
/**
 * A row's name as Markdown that shows it as written: GitHub drops what reads
 * as an HTML tag, such as the `<T>` of a row.
 *
 * @type {(text: string) => string}
 */
const literal = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
/** @type {(subject: Subject) => string[]} */
const over = (subject) => lines.flatMap(({ id, [subject]: entry }) => {
  if (entry?.most === undefined || entry.values.every((sample) => sample < /** @type {number} */ (entry.most))) return [];

  return [`${literal(id)} reads ${format(Math.max(...entry.values), entry.unit)}, at or past its bound of ${format(entry.most, entry.unit)}`];
});
const review = lines.filter(({ flag }) => flag.endsWith('review'));

/** @type {(text: string) => string} */
const cell = (text) => literal(text).replaceAll('|', '\\|');
/** @type {(entry?: Measured) => string} */
const value = (entry) => (entry ? format(median(entry.values), entry.unit) : 'n/a');

const table = trees.master
  ? [
    '| Row | Kind | Master | Head | Delta | Spread (master; head) | Flag |',
    '| --- | --- | ---: | ---: | ---: | --- | --- |',
    ...lines.map((line) => `| ${cell(line.id)} | ${line.kind} | ${value(line.master)} | ${value(line.head)} | ${line.delta} | ${sampled(line.kind) ? [line.master, line.head].map((entry) => (entry ? spread(entry) : 'n/a')).join('; ') : ''} | ${line.flag} |`),
  ]
  : [
    '| Row | Kind | Value | Spread |',
    '| --- | --- | ---: | --- |',
    ...lines.map((line) => `| ${cell(line.id)} | ${line.kind} | ${value(line.head)} | ${line.head ? spread(line.head) : ''} |`),
  ];

const compared = failed.master.size + missing.length + grew.length;

const verdict = [
  ...[...failed.head].map((project) => `- **Failed:** the ${project} project of this branch. The job fails.`),
  ...over('head').map((line) => `- **Over its bound:** ${line}.`),
  ...over('master').map((line) => `- **Over its bound on the base:** ${line}.`),
  ...[...failed.master].map((project) => `- **Failed on the base:** the ${project} project; a row it did not measure reads n/a.`),
  ...missing.map(({ id }) => `- **Missing on head:** ${literal(id)}.`),
  grew.length ? `- **${grew.length} count${grew.length === 1 ? '' : 's'} grew.**` : '',
  compared && !failed.head.size ? `- The job fails on the comparison unless the PR carries the \`${label}\` label.` : '',
  review.length ? `- ${review.length} row${review.length === 1 ? '' : 's'} to review: a size that grew, a time whose spread lies wholly above the base's with its median up by ${100 * THRESHOLD}% or more, or heap held whose spread lies ${HEAP_FLOOR} B or more above the base's. None fails the job.` : '',
].filter(Boolean);

/**
 * The installed version of a package, as `dir` resolves it.
 *
 * @type {(dir: string, dependency: string) => string}
 */
const installed = (dir, dependency) => {
  const file = join(dir, 'node_modules', dependency, 'package.json');

  return `${dependency} ${existsSync(file) ? manifest(dirname(file)).version : 'not installed'}`;
};

/**
 * The runtime dependencies a tree measured, at the versions its install holds.
 *
 * @type {(dir: string) => string}
 */
const dependencies = (dir) => Object.keys(manifest(dir).dependencies ?? {}).map((dependency) => installed(dir, dependency)).join(', ') || 'none';

const environment = [
  `Node ${process.version}, ${platform()} ${arch()}; times are medians of ${samples} process${samples === 1 ? '' : 'es'}${trees.master ? ' per side' : ''}, each the median of its rounds, and heap held is the median of as many processes again, each giving one reading per row. A spread leaves out a quarter of a row's samples, rounded down, at each end. Sizes include the extension's dependencies and leave out its peers.`,
  `${trees.master ? 'Both sides run on ' : 'It runs on '}${[...Object.keys(pkg.peerDependencies ?? {}), 'typescript'].map((dependency) => installed(ROOT, dependency)).join(', ')}.`,
  ...subjects.map((subject) => `${trees.master ? `${subject[0].toUpperCase()}${subject.slice(1)} ships ` : 'Dependencies: '}${dependencies(/** @type {string} */ (trees[subject]))}.`),
].join('\n');

const report = [
  `<!-- bench:${name} -->`,
  `## Benchmark: \`${pkg.name}\``,
  '',
  trees.master ? 'This branch against its base.' : args.compare ? 'This branch; the base has no such package.' : 'This tree.',
  environment,
  '',
  ...(verdict.length ? [...verdict, ''] : trees.master ? [`No count grew, no size grew, no time rose with its spread wholly above the base's and its median up by ${100 * THRESHOLD}% or more, and no heap held rose with its spread ${HEAP_FLOOR} B or more above the base's.`, ''] : []),
  ...table,
  '',
].join('\n');

console.log(`\n${report}`);

if (args.report) writeFileSync(resolve(args.report), report);

if (args.write) {
  /** @type {(kind: Kind, title: string, blurb: string) => string[]} */
  const section = (kind, title, blurb) => {
    const rows = lines.filter((line) => line.kind === kind && line.head);

    if (!rows.length) return [];

    return [
      `## ${title}`,
      '',
      blurb,
      '',
      ...(sampled(kind) ? ['| Row | Median | Spread |', '| --- | ---: | --- |'] : ['| Row | Value |', '| --- | ---: |']),
      ...rows.map((line) => `| ${cell(line.id)} | ${value(line.head)} |${sampled(kind) ? ` ${spread(/** @type {Measured} */ (line.head))} |` : ''}`),
      '',
    ];
  };

  writeFileSync(join(ROOT, 'BENCH.md'), [
    '# Benchmark',
    '',
    `What \`npm run bench\` measured on \`${pkg.name}\` ${pkg.version}, written by the release that published it. A pull request compares its branch with its base in a comment; this file keeps the figures of each release beside its code.`,
    '',
    environment,
    '',
    ...section('count', 'Counts', `Calls, emissions and checker instantiations: the same on every machine. A pull request that grows one fails its benchmark job unless it carries the \`${label}\` label.`),
    ...section('size', 'Sizes', 'Bytes of a browser bundle, the dependencies included and the peers left out: the same on every machine.'),
    ...section('time', 'Times', 'Microseconds and milliseconds, of one machine at one time: compare them only with figures measured beside them.'),
    ...section('heap', 'Heap', 'Bytes of the JavaScript heap an extension holds, the same on every run of one Node version, to a fraction of a byte.'),
  ].join('\n'));
}

if (failed.head.size) process.exitCode = 1;
else if (compared) process.exitCode = 2;
