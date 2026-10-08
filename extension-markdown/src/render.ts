import type { Node, Part } from './parse.js';
import { VOID_ELEMENTS } from './shared/markup.js';
import type { Resolved } from './shared/resolve.js';
import type { Rendered } from './shared/types.js';
import type { Components } from './types.js';

/** What a message renders with no map at all: inline elements only. */
export const DEFAULT_COMPONENTS: Components = { emphasis: 'em', strong: 'strong', code: 'code', link: 'a', break: 'br' };

/** The parts as the map renders them: an unmapped node leaves its children in its place. */
export const apply = (parts: Part[], lookup: (node: Node) => Resolved | undefined): Rendered[] => parts.flatMap((part) => {
  if (typeof part === 'string') return [part];

  const resolved = lookup(part);
  const children = apply(part.children, lookup);

  if (resolved === undefined) return children;

  const { render, props } = resolved;
  const isVoid = typeof render === 'string' && VOID_ELEMENTS.includes(render);

  return [{ render, tag: part.type, props: { ...part.attributes, ...props }, children: isVoid ? [] : children }];
});
