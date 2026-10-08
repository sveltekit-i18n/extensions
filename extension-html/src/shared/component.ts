import type { Component } from 'svelte';

/**
 * `i18n` with `T`: the `render` component, handed the instance and the options
 * on top of the props it is given. A component is a function of the render's
 * internals and its props; `T` hands the internals through untouched. A proxy
 * rather than a spread: a spread would read every prop once and lose its
 * reactivity.
 */
export const withT = <I extends object, P extends Record<string, any>>(i18n: I, render: Component<any>, options: unknown) => {
  const T = ((internals: unknown, props: Record<PropertyKey, unknown>) => (render as (...args: unknown[]) => unknown)(internals, new Proxy(props, {
    get: (target, key) => (key === 'i18n' ? i18n : key === 'options' ? options : Reflect.get(target, key)),
    has: (target, key) => key === 'i18n' || key === 'options' || Reflect.has(target, key),
  }))) as Component<P>;

  return Object.assign(i18n, { T });
};
