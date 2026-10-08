import { describe, expect, it } from 'vitest';

import { parse } from '../../src/parse';
import type { Part } from '../../src/parse';
import { inertPayload } from '../../src/payload';
import { parseAll } from '../commonmark.js';
import { random } from '../random.js';

describe('parse', () => {
  it('makes the innermost of nested links, and leaves the brackets around it text', () => {
    expect(parseAll('x [x [a](b) [y] ](c)').parts).toEqual(['x [x ', { type: 'link', attributes: { href: 'b' }, children: ['a'] }, ' [y] ](c)']);
  });

  it('reads a reference only by its own name', () => {
    expect(parseAll('&constructor; &valueOf; &hasOwnProperty; &amp;').parts).toEqual(['&constructor; &valueOf; &hasOwnProperty; &']);
  });

  it('decodes a reference to a noncharacter or a control as U+FFFD, so it reads as no payload', () => {
    expect(parseAll('&#xFDD2; &#xFDD0; &#0; &#1;').parts).toEqual(['� � � �']);
  });

  it('escapes only punctuation with a backslash in a destination', () => {
    const lineBreak = { type: 'break', attributes: {}, children: ['\n'] };

    expect(parseAll('[a](b\\\nc)').parts).toEqual(['[a](b', lineBreak, 'c)']);
    expect(parseAll('[a](<b\\\nc>)').parts).toEqual(['[a](<b', lineBreak, 'c>)']);
    expect(parseAll('[a](b\\\tc)').parts).toEqual(['[a](b\\\tc)']);
  });

  it('drops the spaces and tabs a line starts with, but for the first', () => {
    expect(parseAll('  x `a\n   b` y').parts).toEqual(['  x ', { type: 'code', attributes: {}, children: ['a b'] }, ' y']);
    expect(parseAll('[a](b "c\n\td")').parts).toEqual([{ type: 'link', attributes: { href: 'b', title: 'c\nd' }, children: ['a'] }]);
  });

  it('drops the spaces, tabs and line endings a message ends with once they hold a line ending', () => {
    expect(['a  \n  ', 'a\\\n  ', 'a\n\t', 'a \n \n'].map((message) => parseAll(message).parts)).toEqual([['a'], ['a\\'], ['a'], ['a']]);
    expect(parseAll('a  ').parts).toEqual(['a  ']);
  });

  it('reads a message of many paragraphs', () => {
    // Each paragraph's emphasis, and the blank lines between them.
    expect(parseAll('*a*\n\n'.repeat(150_000)).parts).toHaveLength(299_999);
  });

  it('checks a URL without the bidi controls around it', () => {
    const { parts, dropped } = parse('[a](⁨javascript:alert(1)⁩) [b](⁨/x⁩)');

    expect(parts).toEqual([{ type: 'link', attributes: {}, children: ['a'] }, ' ', { type: 'link', attributes: { href: '/x' }, children: ['b'] }]);
    expect(dropped).toEqual([{ code: 'url-blocked', node: 'link', attribute: 'href' }]);
  });
});

// What makes a parser give up on a crafted message: cmark's pathological
// inputs, and the ones markdown-it, micromark and marked were found to slow
// down on. Each takes a few hundred milliseconds at 400,000 characters; a
// quadratic step takes seconds at a tenth of that.
const backticks = (n: number) => Array.from({ length: n }, (_, index) => `e${'`'.repeat(index + 1)}`).join('');

const PATHOLOGICAL: Record<string, (n: number) => string> = {
  'nested emphasis': (n) => `${'*a **a '.repeat(n)}b${' a** a*'.repeat(n)}`,
  'emphasis closers': (n) => 'a_ '.repeat(n),
  'emphasis openers': (n) => '_a '.repeat(n),
  'link closers': (n) => 'a]'.repeat(n),
  'link openers': (n) => '[a'.repeat(n),
  'mismatched openers and closers': (n) => '*a_ '.repeat(n),
  'openers below a closer that matches none (cmark#389)': (n) => `${'*a '.repeat(n)}${'_a*_ '.repeat(n)}`,
  'the rule of 3': (n) => `a**b${'c* '.repeat(n)}`,
  'emphasis in link openers': (n) => '[ a_'.repeat(n),
  'parentheses in brackets': (n) => '[ (]('.repeat(n),
  'image brackets': (n) => '![[]()'.repeat(n),
  'nested brackets': (n) => `${'['.repeat(n)}a${']'.repeat(n)}`,
  'backtick runs of every length': (n) => backticks(Math.round(Math.sqrt(n))),
  'unclosed destinations in angle brackets': (n) => '[a](<b'.repeat(n),
  'unclosed destinations': (n) => '[a](b'.repeat(n),
  'unclosed titles': (n) => '[a](b "c'.repeat(n),
  'one deep run of delimiters': (n) => `${'*'.repeat(n)}a${'*'.repeat(n)}`,
  'delimiters between letters': (n) => 'a*'.repeat(n),
  'NUL characters': (n) => 'abc\0de\0'.repeat(n),
  'unterminated references': (n) => `&${'a'.repeat(30)}`.repeat(n),
  'unterminated numeric references': (n) => '&#x'.repeat(n),
  'unclosed email autolinks': (n) => '<a@b'.repeat(n),
  'unclosed URI autolinks': (n) => '<ab:c'.repeat(n),
  'code spans in brackets': (n) => `${'[`'.repeat(n)}${']'.repeat(n)}`,
  'emphasis across links': (n) => `${'[*a'.repeat(n)}${'*](b)'.repeat(n)}`,
  'a link in link text': (n) => `${'['.repeat(n)}[a](b)${']'.repeat(n)}`,
  'escaped parentheses': (n) => `[a](${'\\('.repeat(n)}`,
  'unclosed titles of both quotes': (n) => `[a](b "${'[a](b \''.repeat(n)}`,
  'strong across links': (n) => '**x [a*b**c*](d)'.repeat(n),
  'emphasis between spaces': (n) => '*a* '.repeat(n),
  'spaced line endings before a letter': (n) => `${' \n'.repeat(n)}x`,
  'line endings before a letter': (n) => `${'\n'.repeat(n)}x`,
  'a run of spaces': (n) => `a${' '.repeat(n)}b`,
  'spaces before a line ending': (n) => `${' '.repeat(n)}x\ny`,
  'spaces before a letter': (n) => `${' '.repeat(n)}x`,
  'spaces and tabs before a letter': (n) => `${' \t'.repeat(n)}x`,
  'spaces in a code span': (n) => `\`${' '.repeat(n)}x\``,
  'spaces a reference makes in a destination': (n) => `[x](<a${'&#32;'.repeat(n)}b>)`,
  'paragraphs': (n) => '*a*\n\n'.repeat(n),
};

describe('a crafted message', () => {
  it.each(Object.entries(PATHOLOGICAL))('of %s parses in linear time', (_, message) => {
    let n = 1;

    while (message(n).length < 400_000) n *= 2;

    const subject = message(n);
    const start = performance.now();

    parseAll(subject);
    // Generous for the slowest runner, and still a tenth of what a quadratic
    // step takes at this size.
    expect(performance.now() - start).toBeLessThan(3_000);
  }, 30_000);
});

// A node's type and attribute names, and its children's: what the syntax made
// of a message, whatever its text.
const shape = (parts: Part[]): unknown[] => parts.map((part) => (typeof part === 'string'
  ? 'text'
  : [part.type, Object.keys(part.attributes).sort(), shape(part.children)]));

const TEMPLATE = ['*', '**', '_', '__', '`', '[', ']', '(', ')', '![', '\\', '&', ';', '"', "'", ' ', '  ', '\n', 'a', '.', '](', '](/u "', '{p}', '{p}', '{p}'];
const PAYLOAD = ['*', '_', '`', '[', ']', '(', ')', '<', '>', '!', '\\', '&', ';', '#', '"', "'", ' ', '  ', '\t', '\n', '\r', 'a', 'amp', '42', 'x:', ' ', '.', '﷐', '﷥', '\f', '\0', '⁨'];

describe('a payload', () => {
  // Its other characters still flank a delimiter as they are: a space that is
  // no ASCII one, punctuation, or the U+FFFD a control becomes.
  it('makes of a message what letters in the place of its syntax make, for 20,000 messages', () => {
    const next = random(389);
    const pick = (pieces: string[], length: number) => Array.from({ length }, () => pieces[Math.floor(next() * pieces.length)]).join('');
    const differing: string[][] = [];

    for (let index = 0; index < 20_000; index += 1) {
      const template = pick(TEMPLATE, 1 + Math.floor(next() * 16));
      const payload = pick(PAYLOAD, 1 + Math.floor(next() * 6));
      const inert = inertPayload(payload) as string;

      if (inert.length !== payload.length) differing.push([template, payload, 'length']);
      else if (JSON.stringify(shape(parseAll(template.replaceAll('{p}', inert)).parts)) !== JSON.stringify(shape(parseAll(template.replaceAll('{p}', inert.replace(/[\uFDD0-\uFDEF]/g, 'x'))).parts))) {
        differing.push([template, payload]);
      }
    }

    expect(differing.slice(0, 10)).toEqual([]);
  });

  it('leaves the references a translation begins unfinished', () => {
    expect(parseAll(`Tom &${inertPayload('amp;') as string} &#${inertPayload('42;') as string}`).parts).toEqual(['Tom &amp; &#42;']);
  });
});
