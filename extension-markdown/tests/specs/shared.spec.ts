import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// `extension-html` renders a message through the same modules: each package
// ships its own copy, and the two copies stay one source.
const here = join(import.meta.dirname, '../../src/shared');
const html = join(import.meta.dirname, '../../../extension-html/src/shared');

// A checkout on Windows may turn line endings into CRLF.
const read = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

describe('src/shared', () => {
  it('holds the modules extension-html holds', () => {
    expect(readdirSync(here).sort()).toEqual(readdirSync(html).sort());
  });

  it.each(readdirSync(here))('%s is extension-html\'s, byte for byte', (file) => {
    expect(read(join(here, file))).toBe(read(join(html, file)));
  });
});
