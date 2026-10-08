import type { Extension, I18n } from '@sveltekit-i18n/base';
import type { Component } from 'svelte';

import type { Entry, Props as PropsOf } from './shared/types.js';

export type { Entry };

type AnyI18n = I18n<any, any, any, any>;

/**
 * Entries by the tag a translation names, lower-case: a native element by
 * name (`'strong'` for `<b>`), a component, either of them with props of the
 * app's own, or `null`, which unmaps a tag a lower layer maps.
 */
export type Components = Record<string, Entry>;

export type Report = {
  code: 'tag-unmapped' | 'tag-dropped' | 'attribute-dropped' | 'url-blocked' | 'nesting-invalid';
  key: string;
  locale: string;
  /** The tag as the translation names it; absent for `nesting-invalid`. */
  tag?: string;
  /** The attribute dropped, for `attribute-dropped` and `url-blocked`. */
  attribute?: string;
  message: string;
};

export type Options = {
  /** Where the reports go; `null` discards them. */
  onReport: ((report: Report) => void) | null;
  /** The app's layer of the component map, over the defaults. */
  components?: Components;
};

/** `<T>`'s props: see `PropsOf`, with the tags as the usage's layer of the map. */
export type Props<I> = PropsOf<I, Components>;

export type WithT<I> = I & { T: Component<Props<I>> };

/**
 * An input that is no instance — a pipe that put an extension whose output is
 * no instance first — gets no `T`, so the mistake surfaces where `T` is used.
 */
export interface WithHtml extends Extension.Operator {
  readonly output: this['input'] extends AnyI18n ? WithT<this['input']> : this['input'];
}
