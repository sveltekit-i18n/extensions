import type { Component } from 'svelte';

import type { Entry, Layer } from './types.js';

export type Resolved = { render: string | Component<any>; props: Record<string, unknown> };

/**
 * What `name` renders as: the entry of the highest layer that names it, the
 * layers listed lowest first. The winning entry decides both the element and
 * its props; `null` there leaves the name unmapped. Only own entries count, so
 * a name `constructor` is as unmapped as any other.
 */
export const resolve = (name: string, layers: (Layer | undefined)[]): Resolved | undefined => {
  const layer = [...layers].reverse().find((components) => components !== undefined && Object.hasOwn(components, name));
  const entry: Entry | undefined = layer?.[name];

  if (entry === undefined || entry === null) return undefined;
  if (typeof entry === 'object' && 'component' in entry) return { render: entry.component, props: entry.props ?? {} };

  return { render: entry, props: {} };
};
