import { defaultTreeAdapter, html, parseFragment } from 'parse5';
import type { DefaultTreeAdapterTypes } from 'parse5';

import type { Element, Part } from './parse.js';
import { VOID_ELEMENTS } from './shared/markup.js';
import type { Resolved } from './shared/resolve.js';
import type { Rendered } from './shared/types.js';

/** The parts as the map renders them: an unmapped element leaves its children in its place. */
export const apply = (parts: Part[], lookup: (element: Element) => Resolved | undefined): Rendered[] => parts.flatMap((part) => {
  if (typeof part === 'string') return [part];

  const resolved = lookup(part);
  const children = apply(part.children, lookup);

  if (resolved === undefined) return children;

  const { render, props } = resolved;
  const isVoid = typeof render === 'string' && VOID_ELEMENTS.includes(render);

  return [{ render, tag: part.tag, props: { ...part.attributes, ...props }, children: isVoid ? [] : children }];
});

/** The text of what renders, without its elements. */
export const textOf = (nodes: Rendered[]): string => nodes.map((node) => (typeof node === 'string' ? node : textOf(node.children))).join('');

type Shape = string | [string, Shape[]];

// Built in place, since an element may have any number of children.
const merge = (shapes: Shape[]) => {
  const all: Shape[] = [];

  shapes.forEach((shape) => {
    const last = all[all.length - 1];

    if (shape === '') return;

    if (typeof shape === 'string' && typeof last === 'string') all[all.length - 1] = last + shape;
    else all.push(shape);
  });

  return all;
};

// A component is the app's own markup, so it stands in the tree as the tag it
// renders, which the message's parse placed.
const nameOf = ({ render, tag }: Exclude<Rendered, string>) => (typeof render === 'string' ? render : tag);

const shapeOf = (nodes: Rendered[]): Shape[] => merge(nodes.map((node): Shape => (typeof node === 'string' ? node : [nameOf(node), shapeOf(node.children)])));

const parsedShapeOf = (nodes: DefaultTreeAdapterTypes.ChildNode[]): Shape[] => merge(nodes.flatMap((node): Shape[] => {
  if (defaultTreeAdapter.isTextNode(node)) return [node.value];
  if (!defaultTreeAdapter.isElementNode(node)) return [];

  return [[node.tagName, parsedShapeOf(node.childNodes)]];
}));

const escape = (text: string) => text.replace(/[&<>]/g, (char) => `&#${char.charCodeAt(0)};`);

// As Svelte's server renders it, with an anchor opening each element's content.
const serialize = (nodes: Rendered[]): string => nodes.map((node) => {
  if (typeof node === 'string') return escape(node);

  const name = nameOf(node);

  return VOID_ELEMENTS.includes(name) ? `<${name}>` : `<${name}><!---->${serialize(node.children)}</${name}>`;
}).join('');

/**
 * Whether the markup the server renders of `nodes` parses back into them, as
 * hydration needs. The message parsed into a tree a browser builds, but the
 * map can still break it: an element rendered as another, or one left out
 * that kept its children apart (an `<h2>` inside an unmapped tag inside an
 * `<h1>`). A component is checked as the tag it takes the place of: its own
 * markup is the app's.
 */
export const hydrates = (nodes: Rendered[]) => {
  try {
    const fragment = parseFragment(defaultTreeAdapter.createElement('body', html.NS.HTML, []), serialize(nodes), {});

    return JSON.stringify(parsedShapeOf(fragment.childNodes)) === JSON.stringify(shapeOf(nodes));
  } catch {
    return false;
  }
};
