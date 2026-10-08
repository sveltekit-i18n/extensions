import { flushSync, mount, unmount } from 'svelte';
import type { Component } from 'svelte';

import Page from './components/Page.svelte';

/** Mounts `<i18n.T {...props} />`; `props` is read through a getter, so it stays reactive. */
export const render = (i18n: { T: Component<any> }, props: () => Record<string, unknown>) => {
  const target = document.createElement('div');
  const component = mount(Page, {
    target,
    props: {
      i18n,
      get props() {
        return props();
      },
    },
  });

  flushSync();

  return {
    target,
    // Svelte's anchors are comments; what is asserted is the markup around them.
    html: () => target.innerHTML.replace(/<!--[^>]*-->/g, ''),
    destroy: () => void unmount(component),
  };
};
