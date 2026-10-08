import { defaultTreeAdapter, html, parseFragment } from 'parse5';
import type { DefaultTreeAdapterTypes } from 'parse5';

import { BOOLEAN_ATTRIBUTES, URL_ATTRIBUTES, URL_SCHEMES, attributeValue, isAllowedAttribute } from './elements.js';
import { isAllowedUrl } from './shared/markup.js';

export type Element = {
  tag: string;
  attributes: Record<string, string | true>;
  children: Part[];
  /**
   * Made by the parser, not written in the message: an implied `<tbody>`, or
   * a copy of a formatting element the parser reopened past a block.
   */
  implied?: true;
};

/** A message as the renderer walks it: text, or an element with its parts. */
export type Part = string | Element;

/** What parsing dropped from the message, for the report channel. */
export type Dropped =
  | { code: 'attribute-dropped' | 'url-blocked'; tag: string; attribute: string }
  | { code: 'tag-dropped' | 'tag-unmapped'; tag: string }
  | { code: 'nesting-invalid' };

type Node = DefaultTreeAdapterTypes.ChildNode;

type ParsedElement = DefaultTreeAdapterTypes.Element;

const reference = (char: string) => `&#${char.charCodeAt(0)};`;

// What ends text or a quoted value: enough for a string the parser places
// itself. An unquoted value, which whitespace would end, is never taken from a
// translation (see `parse`).
const escapeText = (text: string) => text.replace(/[&<>"']/g, reference);

// Also what ends an attribute name or an unquoted value: for what a parser
// serialises on its own (the keys and the nested values of a payload, as
// JSON), which may land between the quotes of a value and close them.
const escapeAll = (text: string) => text.replace(/[&<>"'=/`\t\n\f\r ]/g, reference);

const isPlain = (value: object) => {
  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

const walk = (value: unknown, depth: number, seen: WeakMap<object, unknown>): unknown => {
  if (typeof value === 'string') return depth > 1 ? escapeAll(value) : escapeText(value);
  if (typeof value !== 'object' || value === null) return value;

  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const copy: unknown[] = [];

    seen.set(value, copy);
    // By index, so a hole stays where it was.
    for (let index = 0; index < value.length; index += 1) copy[index] = walk(value[index], depth + 1, seen);

    return copy;
  }

  if (!isPlain(value)) return value;

  const copy: Record<string, unknown> = Object.create(null);

  seen.set(value, copy);
  Object.entries(value).forEach(([key, item]) => {
    copy[escapeAll(key)] = walk(item, depth + 1, seen);
  });

  return { ...copy };
};

/**
 * The payload with every string in it escaped, so interpolation can bring no
 * markup the translation does not carry itself — not inside an attribute
 * either. The values a message names keep all but `& < > " '`, so a parser
 * still selects by them; the keys, and what is nested deeper, which a parser
 * can only serialise, are escaped for every character that ends a name or a
 * value. Plain objects and arrays are walked; any other object is the app's
 * own and reaches the parser as it is, since the parser may format it (a
 * `Date`).
 */
export const escapePayload = (value: unknown): unknown => walk(value, 0, new WeakMap());

// Elements whose content is code, a document of its own or no text of the
// message: dropped with their content.
const DISCARDED = [
  'script', 'style', 'title', 'textarea', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript', 'plaintext', 'template',
];

// Integer attributes; Svelte sets `value` as a property, which reads one out
// of the int32 range differently from the attribute the server wrote.
const INTEGER_ATTRIBUTES = ['start', 'value', 'colspan', 'rowspan'];

// As the DOM writes the number back: no sign on zero, no leading zeros.
const isInteger = (value: string) => /^(0|-?[1-9]\d{0,8})$/.test(value);

// The element levels of a message, far below the 512 at which a browser stops
// nesting. A render recurses per level, and an app's component adds levels of
// its own, which no bound here can count.
const MAX_DEPTH = 32;

// By a stack of its own: a tree too deep to render is too deep to recurse over.
const depthOf = (nodes: Node[]) => {
  const stack: [Node, number][] = nodes.map((node) => [node, 1]);
  let max = 0;

  for (let entry = stack.pop(); entry; entry = stack.pop()) {
    const [node, depth] = entry;

    if (defaultTreeAdapter.isElementNode(node)) {
      max = Math.max(max, depth);
      node.childNodes.forEach((child) => stack.push([child, depth + 1]));
    }
  }

  return max;
};

/** The text of parts, without their elements. */
export const text = (part: Part): string[] => (typeof part === 'string' ? [part] : part.children.flatMap(text));

/**
 * Parses a message into parts with the HTML parser of the standard, in the
 * context of a `<body>`, so the tree is the one a browser builds from the
 * message — and from the markup the server renders of it, which therefore
 * hydrates. Comments are dropped, and each element keeps only the attributes
 * its tag allows, with a URL gated by its scheme and each value quoted: the
 * payload escapes quotes, while whitespace would end an unquoted value and
 * start an attribute of its own. A tag the parser reports an error in (a
 * value whose quotes a parser's own serialisation closed early) keeps none.
 * Never throws: a translation is data.
 */
export const parse = (message: string): { parts: Part[]; dropped: Dropped[] } => {
  const dropped: Dropped[] = [];
  const errors: number[] = [];

  const hasError = ({ sourceCodeLocation }: ParsedElement) => {
    const tag = sourceCodeLocation?.startTag;

    return tag !== undefined && errors.some((offset) => offset >= tag.startOffset && offset < tag.endOffset);
  };

  const isUnquoted = ({ sourceCodeLocation }: ParsedElement, name: string) => {
    const location = sourceCodeLocation?.attrs?.[name];

    return location !== undefined && /^[^=]*=\s*[^\s"']/.test(message.slice(location.startOffset, location.endOffset));
  };

  // By the attributes' token, which the parser shares between an element and
  // each copy of it it makes: a copy takes what was decided for the element it
  // copies, with or without the location the parser may give it, and reports
  // nothing again.
  const decided = new Map<ParsedElement['attrs'], Element['attributes']>();

  const attributesOf = (element: ParsedElement) => {
    const { tagName: tag, attrs } = element;

    const known = decided.get(attrs);

    if (known !== undefined) return known;
    if (!element.sourceCodeLocation) return {};

    const broken = hasError(element);
    const attributes = attrs.reduce<Element['attributes']>((all, { name, value: written }) => {
      const value = attributeValue(name, written);

      if (broken || isUnquoted(element, name) || !isAllowedAttribute(tag, name) || (INTEGER_ATTRIBUTES.includes(name) && !isInteger(value))) {
        dropped.push({ code: 'attribute-dropped', tag, attribute: name });

        return all;
      }

      if (URL_ATTRIBUTES.includes(name) && !isAllowedUrl(value, URL_SCHEMES)) {
        dropped.push({ code: 'url-blocked', tag, attribute: name });

        return all;
      }

      // A boolean attribute is on whatever its value; `true` is what Svelte
      // renders as present, while any other attribute keeps its string.
      return { ...all, [name]: BOOLEAN_ATTRIBUTES.includes(name) ? true : value };
    }, {});

    decided.set(attrs, attributes);

    return attributes;
  };

  // The text of a tree too deep to walk as parts, by a stack of its own.
  const textOf = (nodes: Node[]) => {
    const stack = [...nodes].reverse();
    let all = '';

    for (let node = stack.pop(); node; node = stack.pop()) {
      if (defaultTreeAdapter.isTextNode(node)) all += node.value;
      else if (defaultTreeAdapter.isElementNode(node)) {
        if (DISCARDED.includes(node.tagName)) dropped.push({ code: 'tag-dropped', tag: node.tagName });
        else for (let index = node.childNodes.length - 1; index >= 0; index -= 1) stack.push(node.childNodes[index]);
      }
    }

    return all;
  };

  // Built in place, since an element may have any number of children; each
  // text joins the text before it.
  const partsOf = (nodes: Node[]): Part[] => {
    const parts: Part[] = [];

    const add = (part: Part) => {
      const last = parts[parts.length - 1];

      if (typeof part === 'string' && typeof last === 'string') parts[parts.length - 1] = last + part;
      else parts.push(part);
    };

    nodes.forEach((node) => {
      if (defaultTreeAdapter.isTextNode(node)) return add(node.value);

      if (!defaultTreeAdapter.isElementNode(node)) return;

      if (DISCARDED.includes(node.tagName)) return void dropped.push({ code: 'tag-dropped', tag: node.tagName });

      // SVG and MathML: their elements are no HTML ones of the same name.
      if (node.namespaceURI !== html.NS.HTML) {
        dropped.push({ code: 'tag-unmapped', tag: node.tagName });

        return partsOf(node.childNodes).flatMap(text).forEach(add);
      }

      const implied = !node.sourceCodeLocation || decided.has(node.attrs);
      const attributes = attributesOf(node);
      const children = partsOf(node.childNodes);

      add({ tag: node.tagName, attributes, children, ...(implied ? { implied: true as const } : {}) });
    });

    return parts;
  };

  try {
    const fragment = parseFragment(defaultTreeAdapter.createElement('body', html.NS.HTML, []), message, {
      sourceCodeLocationInfo: true,
      onParseError: ({ startOffset }) => errors.push(startOffset),
    });

    if (depthOf(fragment.childNodes) > MAX_DEPTH) {
      const parts = [textOf(fragment.childNodes)];

      return { parts, dropped: [{ code: 'nesting-invalid' }, ...dropped] };
    }

    return { parts: partsOf(fragment.childNodes), dropped };
  } catch {
    return { parts: [message], dropped: [] };
  }
};
