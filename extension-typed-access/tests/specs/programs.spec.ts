import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { expect, it } from 'vitest';

const run = promisify(execFile);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// The compiler's own entry: the `node_modules/.bin` shim is an extensionless
// shell script on Windows, which `execFile` cannot spawn.
const TSC = resolve(ROOT, 'node_modules/typescript/bin/tsc');

// What `tsc` reports: it reports on stdout and exits non-zero, and a
// rejection carrying nothing is the compiler failing to run.
const compile = (project: string) => run(process.execPath, [TSC, '-p', resolve(ROOT, project)])
  .then(() => '', (failure: { stdout?: string }) => {
    if (!failure.stdout) throw failure;

    return failure.stdout.trim();
  });

// Each directory under tests/types is a program of its own, compiled against
// the build, so these run after `npm run build`, as `npm test` does.
it('types the tree by the schema registered in SvelteKitI18n.Register', async () => {
  expect(await compile('tests/types/registry/tsconfig.json')).toBe('');
}, 60_000);

it('types the tree by the levels typegen registers, as it groups the keys', async () => {
  expect(await compile('tests/types/tree/tsconfig.json')).toBe('');
}, 60_000);

it('groups the keys where the app declares one beside the generated ones', async () => {
  expect(await compile('tests/types/merged/tsconfig.json')).toBe('');
}, 60_000);

it('groups the keys where the app declares one under a namespace typegen left open', async () => {
  expect(await compile('tests/types/absorbed/tsconfig.json')).toBe('');
}, 60_000);

it('groups the keys where the patterns are not the generated ones', async () => {
  expect(await compile('tests/types/patterned/tsconfig.json')).toBe('');
}, 60_000);

it('hands back the outputs a library exports through its emitted declarations', async () => {
  expect(await compile('tests/types/library/tsconfig.lib.json')).toBe('');
  expect(await compile('tests/types/library/tsconfig.json')).toBe('');
}, 120_000);
