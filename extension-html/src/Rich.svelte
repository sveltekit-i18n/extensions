<script lang="ts">
  import type { I18n } from '@sveltekit-i18n/base';
  import { untrack } from 'svelte';

  import { DEFAULT_ELEMENTS } from './elements.js';
  import { escapePayload, parse } from './parse.js';
  import type { Element } from './parse.js';
  import { apply, hydrates, textOf } from './render.js';
  import Parts from './shared/Parts.svelte';
  import { names, resolve } from './shared/resolve.js';
  import type { Components, Options, Report } from './types.js';

  type Props = {
    i18n: I18n<any, any, any, any>;
    options: Options;
    key: string;
    params?: unknown;
    args?: unknown[];
    locale?: string;
    components?: Components;
  };

  const { i18n, options, key, params, args = [], locale, components }: Props = $props();

  // A report channel is app code: a throwing one must not take a render down,
  // and one that reads or writes state must not tie the render to that state.
  const report = (entry: Omit<Report, 'key' | 'locale'>) => untrack(() => {
    try {
      options.onReport?.({ key, locale: locale ?? i18n.locale, ...entry });
    } catch {
      return;
    }
  });

  // A payload that cannot be walked (a getter that throws) renders without it.
  const escaped = (value: unknown) => {
    try {
      return escapePayload(value);
    } catch {
      return undefined;
    }
  };

  const text = (value: unknown) => {
    if (typeof value === 'string') return value;

    try {
      return String(value);
    } catch {
      return '';
    }
  };

  const parts = $derived.by(() => {
    const payload = escaped(params);
    const message = text(locale === undefined
      ? (i18n.t as (key: string, ...params: unknown[]) => unknown)(key, payload, ...args)
      : (i18n.l as (locale: string, key: string, ...params: unknown[]) => unknown)(locale, key, payload, ...args));
    const parsed = parse(message);

    parsed.dropped.forEach((dropped) => {
      switch (dropped.code) {
        case 'tag-dropped':
          return report({ ...dropped, message: `Tag <${dropped.tag}> in the message for key '${key}' holds no text of the message; it was dropped with its content.` });
        case 'tag-unmapped':
          return report({ ...dropped, message: `Tag <${dropped.tag}> in the message for key '${key}' is no HTML element; its text was rendered without it.` });
        case 'nesting-invalid':
          return report({ ...dropped, message: `The message for key '${key}' nests elements deeper than a render takes; it was rendered as text.` });
        case 'url-blocked':
          return report({ ...dropped, message: `The URL in attribute '${dropped.attribute}' of <${dropped.tag}> in the message for key '${key}' has a scheme that is not allowed; the attribute was dropped.` });
        default:
          return report({ ...dropped, message: `Attribute '${dropped.attribute}' of <${dropped.tag}> in the message for key '${key}' is not allowed from a translation, its value is not one it takes, or its quoting broke; it was dropped.` });
      }
    });

    return parsed.parts;
  });

  const lookup = ({ tag, implied }: Element) => {
    const resolved = resolve(tag, [DEFAULT_ELEMENTS, options.components, components]);
    // An element the parser implied was never written, and `null` unmaps a
    // tag on purpose: nothing to report.
    const named = [options.components, components].some((layer) => names(layer, tag));

    if (resolved === undefined && !implied && !named) {
      report({
        code: 'tag-unmapped',
        tag,
        message: `Tag <${tag}> in the message for key '${key}' is not mapped; its content was rendered without it.`,
      });
    }

    return resolved;
  };

  const rendered = $derived.by(() => {
    const nodes = apply(parts, lookup);

    if (hydrates(nodes)) return nodes;

    report({
      code: 'nesting-invalid',
      message: `The elements of the message for key '${key}', as the map renders them, would not parse back into the same tree; it was rendered as text.`,
    });

    return [textOf(nodes)];
  });
</script>

<Parts nodes={rendered} />
