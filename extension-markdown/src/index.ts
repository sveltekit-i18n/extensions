import type { Extension, I18n } from '@sveltekit-i18n/base';

import Rich from './Rich.svelte';
import { withT } from './shared/component.js';
import type { Options, Props, WithMarkdown, WithT } from './types.js';

export type { Components, Entry, Options, Props, Report, WithMarkdown, WithT } from './types.js';

type AnyI18n = I18n<any, any, any, any>;

/**
 * Renders the Markdown a translation carries as elements and components:
 * `<i18n.T key="intro" params={{ name }} />`. The extension adds `T` to the
 * instance it receives and returns that instance, so it goes before any
 * extension whose output is no instance, such as `extension-stores`.
 */
const markdown = (options: Options) => {
  if (typeof options !== 'object' || options === null || typeof (options as Partial<AnyI18n>).loadTranslations === 'function') {
    throw new TypeError('markdown is a factory of the options: put `markdown({ onReport })` in `extensions`.');
  }

  const applied = new WeakSet<object>();

  const extension = <I extends AnyI18n>(i18n: I): WithT<I> => {
    if (applied.has(i18n)) return i18n as WithT<I>;

    if (typeof i18n?.t !== 'function' || typeof i18n.l !== 'function') {
      throw new TypeError('markdown() needs the instance itself: put it before any extension whose output is no instance, such as `stores`.');
    }

    const augmented = withT<I, Props<I>>('markdown', i18n, Rich, options);

    applied.add(i18n);

    return augmented;
  };

  return extension as typeof extension & Extension.Generic<WithMarkdown>;
};

export default markdown;
