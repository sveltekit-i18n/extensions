import type { Component } from 'svelte';

// The `T`s this package made, whichever options made them.
const made = new WeakSet<object>();

/**
 * `i18n` with `T`: the `render` component, handed the instance and the options
 * on top of the props it is given. A component is a function of the render's
 * internals and its props; `T` hands the internals through untouched. A proxy
 * rather than a spread: a spread would read every prop once and lose its
 * reactivity. A `T` this package made is replaced; one another extension
 * added throws, as the two would render one message two ways.
 */
export const withT = <I extends object, P extends Record<string, any>>(name: string, i18n: I, render: Component<any>, options: unknown) => {
  const current: unknown = (i18n as { T?: unknown }).T;

  if (current !== undefined && !(typeof current === 'function' && made.has(current))) {
    throw new TypeError(`${name}() adds \`T\` to an instance that has one from another extension: extension-html and extension-markdown each render a whole message, so use one.`);
  }

  const T = ((internals: unknown, props: Record<PropertyKey, unknown>) => (render as (...args: unknown[]) => unknown)(internals, new Proxy(props, {
    get: (target, key) => (key === 'i18n' ? i18n : key === 'options' ? options : Reflect.get(target, key)),
    has: (target, key) => key === 'i18n' || key === 'options' || Reflect.has(target, key),
  }))) as Component<P>;

  made.add(T);

  return Object.assign(i18n, { T });
};
