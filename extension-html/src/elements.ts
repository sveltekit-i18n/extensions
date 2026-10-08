import { withoutBidi } from './shared/markup.js';
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

const TEXT_ATTRIBUTES = ['title'];

/** The value an attribute renders and is checked with. */
export const attributeValue = (attribute: string, value: string) => (TEXT_ATTRIBUTES.includes(attribute) ? value : withoutBidi(value));

export const BOOLEAN_ATTRIBUTES = ['open', 'reversed'];

/** The schemes a URL a translation carries may have. */
export const URL_SCHEMES = ['http', 'https', 'mailto', 'tel'];
