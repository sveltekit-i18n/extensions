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
it('types `preload` as undefined on a core without it', async () => {
  expect(await compile('tests/types/earlier/tsconfig.json')).toBe('');
}, 60_000);
