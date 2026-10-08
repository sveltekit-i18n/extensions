import spec from 'commonmark-spec';
import { describe, expect, it } from 'vitest';

import { html, oracle, parseAll } from '../commonmark.js';
import { random } from '../random.js';

const INLINE = ['Backslash escapes', 'Entity and numeric character references', 'Code spans', 'Emphasis and strong emphasis', 'Links', 'Images', 'Autolinks', 'Hard line breaks', 'Soft line breaks', 'Textual content'];

// The spec writes a tab as `→`.
const examples = spec.tests.map((example) => ({ ...example, markdown: example.markdown.replace(/→/g, '\t'), html: example.html.replace(/→/g, '\t') }));

// The examples whose HTML holds raw HTML, which a message renders as text:
// markdown-it with `html: false` reads them below.
const RAW_HTML = [344, 475, 476, 477, 491, 494, 524, 642, 643];

describe('the CommonMark spec', () => {
  // A paragraph of the inline sections, as a message: a paragraph's start and
  // end drop their whitespace, which a message keeps.
  const paragraphs = examples.filter(({ section, markdown, html: expected }) => INLINE.includes(section)
    && /^<p>[\s\S]*<\/p>\n$/.test(expected) && !expected.slice(3).includes('<p>')
    && !/^ {0,3}\[[^\]]*\]:/m.test(markdown));

  const rendered = (markdown: string) => html(parseAll(markdown.trim()).parts);

  it.each(paragraphs.filter(({ number }) => !RAW_HTML.includes(number)).map((example) => [example.number, example] as const))('renders example %i as the spec', (_, example) => {
    expect(rendered(example.markdown)).toBe(example.html.slice(3, -5));
  });

  it.each(RAW_HTML)('renders the raw HTML of example %i as text', (number) => {
    const example = examples[number - 1];

    expect(rendered(example.markdown)).not.toBe(example.html.slice(3, -5));
    expect(rendered(example.markdown)).toBe(html(oracle(example.markdown.trim())));
  });
});

describe('markdown-it', () => {
  it.each(examples.map((example) => [example.number, example.markdown] as const))('reads example %i as markdown-it', (_, markdown) => {
    expect(parseAll(markdown).parts).toEqual(oracle(markdown));
  });
});

const PIECES = ['*', '**', '_', '__', '`', '``', '[', ']', '(', ')', '![', '<', '>', '\\', '&', ';', '#', 'x', '&amp;', '&#42;', '&#x2a;', '&nbsp;', '"', "'", ' ', '  ', '\t', '\n', '\r', '\0', 'a', 'b', ':', '/', '@', '.', 'http:', 'a@b.c', '](', '](<', '"t")', ' (t)', '[a](b)', '<a:b>', '.', '!', '\u00a0', 'é', '-', '1'];

describe('fuzz', () => {
  it('reads what markdown-it reads, for 50,000 messages of the syntax\'s characters', () => {
    const next = random(248);
    const differing: string[] = [];

    for (let index = 0; index < 50_000; index += 1) {
      const length = 1 + Math.floor(next() * 24);
      const message = Array.from({ length }, () => PIECES[Math.floor(next() * PIECES.length)]).join('');

      // markdown-it lets a backslash escape a line ending or a tab in a
      // destination, which holds neither.
      if (/\]\([^]*\\[\t\n\r]/.test(message)) continue;
      if (JSON.stringify(parseAll(message).parts) !== JSON.stringify(oracle(message))) differing.push(message);
    }

    expect(differing.slice(0, 10)).toEqual([]);
  });
});
