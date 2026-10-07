// What `measure.mjs` hands the module a package measures a project with,
// `<package>/bench/<project>.ts`, whose default export is a `Measure`. Each
// package's `tsc` reads this file through the type-only import of its modules;
// nothing runs it.

/**
 * What a row measures, which decides how a difference is read:
 * - `count`: an algorithmic count — calls, emissions, checker instantiations.
 *   The same on every machine, and a growth fails the job unless the pull
 *   request carries the package's `bench-accepted:<package>` label.
 * - `size`: bytes. The same on every machine, but nearly every change of
 *   runtime code grows one, so a growth is flagged for review.
 * - `time`: milliseconds or microseconds, which vary from run to run: a
 *   difference counts only when one side's spread lies wholly beyond the
 *   other's and the median moved by 5% or more, and a rise is flagged for
 *   review.
 * - `heap`: bytes of heap held per operation (`hold`): a difference counts
 *   only when one side's spread lies 2 B or more beyond the other's, and a
 *   growth is flagged for review.
 */
export type Kind = 'count' | 'size' | 'time' | 'heap';

// Members are properties, not methods: a module destructures them.
export interface Bench {
  /** The package root the benchmark runs from, whose install holds the tools, the core and `svelte`. */
  root: string;
  /** The package root measured, whose `dist/` the module imports by the package's name. */
  tree: string;
  record: (id: string, kind: Kind, unit: string, value: number) => void;
  /**
   * A heap row that fails the project once a reading reaches `most`, after the
   * rows are written: on the base, it is only reported.
   */
  bounded: (id: string, unit: string, value: number, most: number) => void;
  /**
   * The median duration of `fn` in milliseconds per call, over `samples`
   * rounds (15) of `inner` calls (1) each, after three rounds that warm up.
   * `fn` receives the index of the call, warm-up included.
   */
  time: (fn: (index: number) => unknown, options?: { inner?: number; samples?: number }) => number;
  /** `time` for an asynchronous `fn`, each call awaited before the next. */
  timeAsync: (fn: (index: number) => Promise<unknown>, options?: { inner?: number; samples?: number }) => Promise<number>;
  /**
   * The bytes of heap held per operation over `count` operations that `run`
   * makes: the median of three rounds, each read from a collected heap. A
   * pointer kept per operation shows in every round, while a one-off — a
   * table that grows, a cache that empties — lands in one and drops out. In
   * the heap project only.
   */
  hold: (run: (count: number) => unknown, count: number) => Promise<number>;
}

export type Measure = (bench: Bench) => void | Promise<void>;
