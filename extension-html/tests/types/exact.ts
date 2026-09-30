import { I18n } from '@sveltekit-i18n/base';
import type { Parser } from '@sveltekit-i18n/base';
import type { ComponentProps } from 'svelte';

import html from '../../src';
import type { Props } from '../../src';

// The props `<T>` must accept under `exactOptionalPropertyTypes`, which
// `tests/specs/exact.spec.ts` compiles with. Never run.

type Schema = { plain: void; greeting: { name: string }; hint: { n?: number } };

const parser: Parser.T<[payload?: Record<string, unknown>, options?: { strict: boolean }]> = { parse: (text) => String(text) };

export const typed = new I18n({ initLocale: 'en', parser, schema: {} as Schema, extensions: [html({ onReport: null })] });

declare const keys: 'plain' | 'hint';
declare const locale: string | undefined;
declare const payload: Record<string, unknown> | undefined;

export const accepted: ComponentProps<typeof typed.T>[] = [
  { key: 'plain', args: undefined },
  { key: 'plain', params: undefined, args: undefined },
  { key: 'hint', params: undefined, args: undefined },
  { key: 'greeting', params: { name: 'Ann' }, args: undefined },
  { key: keys, args: undefined },
  { key: 'greeting', params: { name: 'Ann' }, locale, components: undefined },
];

export const plain = new I18n({ initLocale: 'en', parser, extensions: [html({ onReport: null })] });

export const untyped: Props<I18n>[] = [{ key: 'anything', args: undefined }];

export const schemaless: ComponentProps<typeof plain.T>[] = [
  { key: 'anything', params: payload },
  { key: 'anything', params: undefined, args: undefined },
];
