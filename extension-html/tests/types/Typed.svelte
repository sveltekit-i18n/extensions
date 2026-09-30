<!--
  The usages `<T>`'s typing must accept, compiled by `svelte-check`; what it
  must reject is asserted in `props.ts`. Never mounted.
-->
<script lang="ts">
  import { I18n } from '@sveltekit-i18n/base';
  import type { Parser } from '@sveltekit-i18n/base';

  import html from '../../src';

  type Many = { [K in `k${0 | 1 | 2}${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`]: void };
  type Schema = Many & { greeting: { name: string }; hint: { n?: number } };

  const parser: Parser.T<[payload?: Record<string, unknown>, options?: { strict: boolean }]> = { parse: (text) => String(text) };

  const typed = new I18n({
    initLocale: 'en',
    fallbackLocale: 'cs',
    parser,
    schema: {} as Schema,
    extensions: [html({ onReport: null })],
  });
  const loose = new I18n({ parser, extensions: [html({ onReport: null })] });

  const { many, bare }: { many: keyof Many; bare: keyof Many | 'hint' } = $props();
</script>

<typed.T key="greeting" params={{ name: 'Ann' }} />
<typed.T key="greeting" params={{ name: 'Ann' }} args={[{ strict: true }]} locale="cs" />
<typed.T key="hint" />
<typed.T key="hint" params={{ n: 1 }} />
<typed.T key="k00" components={{ b: 'strong', x: null }} />
<typed.T key={many} />
<typed.T key={bare} />

<loose.T key="anything" params={{ any: 'thing' }} />
