import type { Extension, I18n } from '@sveltekit-i18n/base';
import type { Component } from 'svelte';

import Rich from './Rich.svelte';
import type { Options, Props, WithHtml, WithT } from './types.js';

export { BLOCK_ELEMENTS } from './elements.js';
export type { Components, Entry, Options, Props, Report, WithHtml, WithT } from './types.js';

type AnyI18n = I18n<any, any, any, any>;

/**
 * Renders the markup a translation carries as elements and components:
 * `<i18n.T key="intro" params={{ name }} />`. The extension adds `T` to the
 * instance it receives and returns that instance, so it goes before any
 * extension whose output is no instance, such as `extension-stores`.
 */
const html = (options: Options) => {
  if (typeof options !== 'object' || options === null || typeof (options as Partial<AnyI18n>).loadTranslations === 'function') {
    throw new TypeError('html is a factory of the options: put `html({ onReport })` in `extensions`.');
  }

  const applied = new WeakMap<object, unknown>();

  const extension = <I extends AnyI18n>(i18n: I): WithT<I> => {
    if (applied.has(i18n)) return i18n as WithT<I>;

    if (typeof i18n?.t !== 'function' || typeof i18n.l !== 'function') {
      throw new TypeError('html() needs the instance itself: put it before any extension whose output is no instance, such as `stores`.');
    }

    // A component is a function of the render's internals and its props. `T`
    // hands the internals through untouched and adds the instance and the
    // options to the props. A proxy rather than a spread: a spread would read
    // every prop once and lose its reactivity.
    const T = ((internals: unknown, props: Record<PropertyKey, unknown>) => (Rich as (...args: unknown[]) => unknown)(internals, new Proxy(props, {
      get: (target, name) => (name === 'i18n' ? i18n : name === 'options' ? options : Reflect.get(target, name)),
      has: (target, name) => name === 'i18n' || name === 'options' || Reflect.has(target, name),
    }))) as Component<Props<I>>;

    applied.set(i18n, T);

    return Object.assign(i18n, { T });
  };

  return extension as typeof extension & Extension.Generic<WithHtml>;
};

export default html;
