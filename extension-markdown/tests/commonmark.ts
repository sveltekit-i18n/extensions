import MarkdownIt from 'markdown-it';

import { parse } from '../src/parse.js';
import type { Node, Part } from '../src/parse.js';

/** Every URL taken: the conformance is the syntax's, the gate is tested apart. */
export const parseAll = (message: string) => parse(message, () => true);

// markdown-it as the spec reads a paragraph: no raw HTML, URLs as written,
// and nesting as deep as the input.
const md = new MarkdownIt('commonmark', { html: false, maxNesting: 10_000 });

md.normalizeLink = (url) => url;
md.normalizeLinkText = (url) => url;
md.validateLink = () => true;

type Token = ReturnType<typeof md.parseInline>[number];

// How the spec's examples write a URL: percent-encoded.
const encoding = new MarkdownIt('commonmark');

const altOf = (tokens: Token[]): string => tokens.map((token) => {
  if (token.type === 'image') return altOf(token.children ?? []);
  if (token.type === 'softbreak' || token.type === 'hardbreak') return '\n';

  return token.type === 'text' || token.type === 'code_inline' ? token.content : '';
}).join('');

const merge = (parts: Part[]) => parts.reduce<Part[]>((all, part) => {
  const last = all[all.length - 1];

  if (typeof part === 'string' && typeof last === 'string') return [...all.slice(0, -1), last + part];

  return part === '' ? all : [...all, part];
}, []);

const fromTokens = (tokens: Token[]): Part[] => {
  const root: Node = { type: 'paragraph', attributes: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];

  tokens.forEach((token) => {
    const attributes = Object.fromEntries((token.attrs ?? []).map(([name, value]) => [name, String(value)]));

    switch (token.type) {
      case 'text': return top().children.push(token.content);
      case 'softbreak': return top().children.push('\n');
      case 'hardbreak': return top().children.push({ type: 'break', attributes: {}, children: ['\n'] });
      case 'code_inline': return top().children.push({ type: 'code', attributes: {}, children: [token.content] });
      case 'image': {
        const alt = altOf(token.children ?? []);
        const { src, title } = attributes;

        return top().children.push({ type: 'image', attributes: { src, ...(title === undefined ? {} : { title }), alt }, children: [alt] });
      }
      case 'em_open':
      case 'strong_open':
      case 'link_open': {
        const node: Node = { type: token.type === 'em_open' ? 'emphasis' : token.type === 'strong_open' ? 'strong' : 'link', attributes, children: [] };

        top().children.push(node);

        return stack.push(node);
      }
      case 'em_close':
      case 'strong_close':
      case 'link_close': {
        const node = stack.pop() as Node;

        return void (node.children = merge(node.children));
      }
      default:
        throw new Error(`token ${token.type}`);
    }
  });

  return merge(root.children);
};

/**
 * What markdown-it makes of a message, cut into paragraphs as `parse` cuts
 * it, with the spaces and tabs its block parser drops at the start of a line:
 * the reference of the inline syntax, apart from the cut.
 */
export const oracle = (message: string): Part[] => {
  const paragraphs = message.replace(/\r\n?/g, '\n').replace(/\0/g, '�').replace(/(?:[ \t]*\n)+[ \t]*$/, '')
    .split(/[ \t]*\n[ \t]*\n[ \t\n]*/)
    .filter((paragraph, index) => paragraph !== '' || index === 0)
    .map((paragraph) => paragraph.replace(/\n[ \t]+/g, '\n'))
    .map((paragraph) => fromTokens(md.parseInline(paragraph, {})[0].children ?? []));

  if (paragraphs.length === 1) return paragraphs[0];

  return paragraphs.flatMap((children, index): Part[] => [...(index > 0 ? ['\n\n'] : []), { type: 'paragraph', attributes: {}, children }]);
};

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const attribute = (name: string, value: string | undefined, url = false) => (value === undefined ? '' : ` ${name}="${escape(url ? encoding.normalizeLink(value) : value)}"`);

/** Parts as the spec's examples write their HTML. */
export const html = (parts: Part[]): string => parts.map((part) => {
  if (typeof part === 'string') return escape(part);

  const { href, src, title, alt } = part.attributes;

  switch (part.type) {
    case 'break': return '<br />\n';
    case 'emphasis': return `<em>${html(part.children)}</em>`;
    case 'strong': return `<strong>${html(part.children)}</strong>`;
    case 'code': return `<code>${html(part.children)}</code>`;
    case 'link': return `<a${attribute('href', href, true)}${attribute('title', title)}>${html(part.children)}</a>`;
    case 'image': return `<img${attribute('src', src, true)}${attribute('alt', alt)}${attribute('title', title)} />`;
    default: return `<p>${html(part.children)}</p>`;
  }
}).join('');
