import type { Component } from 'svelte';

import type { Components, Entry } from './types.js';

export type Resolved = { render: string | Component<any>; props: Record<string, unknown> };

/**
 * What `tag` renders as: the entry of the highest layer that names it, the
 * layers listed lowest first. The winning entry decides both the element and
 * its props; `null` there leaves the tag unmapped. Only own entries count, so a
 * tag named `constructor` is as unmapped as any other.
 */
export const resolve = (tag: string, layers: (Components | undefined)[]): Resolved | undefined => {
  const layer = [...layers].reverse().find((components) => components !== undefined && Object.hasOwn(components, tag));
  const entry: Entry | undefined = layer?.[tag];

  if (entry === undefined || entry === null) return undefined;
  if (typeof entry === 'object' && 'component' in entry) return { render: entry.component, props: entry.props ?? {} };

  return { render: entry, props: {} };
};
