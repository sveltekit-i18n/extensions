import type { Components } from './types.js';

const asThemselves = (names: string[]): Components => names.reduce<Components>((map, name) => ({ ...map, [name]: name }), {});

/** What a translation may use with no map at all: inline formatting only. */
export const DEFAULT_ELEMENTS: Components = asThemselves([
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'small', 'mark', 'code', 'sub', 'sup', 'br', 'span', 'bdi', 'bdo',
]);

/**
 * Block and structural elements, off by default: a `<T>` in an inline context
 * (inside a `<p>` or a `<button>`) cannot hold them, and the translator who
 * writes the tag cannot know the context. Enable them where it can:
 * `html({ components: BLOCK_ELEMENTS })` or `<T components={BLOCK_ELEMENTS} />`.
 */
export const BLOCK_ELEMENTS: Components = asThemselves([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'pre', 'hr',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'details', 'summary',
]);

const GLOBAL_ATTRIBUTES = ['title', 'lang', 'dir', 'translate'];

/**
 * The attributes a translation may set, per tag it names. Anything else — an
 * event handler, `class`, `style`, `id`, `ping`, whatever a later HTML adds —
 * is dropped: the app sets those through an entry's `props`.
 */
const ELEMENT_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'hreflang', 'target'],
  ol: ['start', 'reversed', 'type'],
  li: ['value'],
  td: ['colspan', 'rowspan', 'headers', 'scope'],
  th: ['colspan', 'rowspan', 'headers', 'scope'],
  details: ['open'],
};

export const isAllowedAttribute = (tag: string, attribute: string) => GLOBAL_ATTRIBUTES.includes(attribute)
  || (Object.hasOwn(ELEMENT_ATTRIBUTES, tag) && ELEMENT_ATTRIBUTES[tag].includes(attribute));

export const URL_ATTRIBUTES = ['href'];

export const BOOLEAN_ATTRIBUTES = ['open', 'reversed'];

const URL_SCHEMES = ['http', 'https', 'mailto', 'tel'];

/**
 * Whether a URL a translation carries may be rendered: one with no scheme (a
 * relative URL, a fragment) or one of `URL_SCHEMES`. The value arrives with
 * its entities decoded; the URL parser also drops tabs and newlines anywhere
 * and C0 controls and spaces at either end, so `java\tscript:` is checked as
 * the `javascript:` a browser would follow.
 */
export const isAllowedUrl = (value: string) => {
  // eslint-disable-next-line no-control-regex
  const url = value.replace(/[\t\n\r]/g, '').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1];

  return scheme === undefined || URL_SCHEMES.includes(scheme.toLowerCase());
};

/** Elements that take no children; rendered without any. */
export const VOID_ELEMENTS = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'];
