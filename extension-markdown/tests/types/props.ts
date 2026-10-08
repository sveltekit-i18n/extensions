import { I18n } from '@sveltekit-i18n/base';
import type { Parser } from '@sveltekit-i18n/base';
import type { ComponentProps } from 'svelte';

import markdown from '../../src';

// The props `<T>` must reject, asserted by compiling. Never run.

type Schema = { plain: void; greeting: { name: string }; hint: { n?: number }; loose: any };

const parser: Parser.T<[payload?: Record<string, unknown>, options?: { strict: boolean }]> = { parse: (text) => String(text) };

export const typed = new I18n({ initLocale: 'en', parser, schema: {} as Schema, extensions: [markdown({ onReport: null })] });

type Props = ComponentProps<typeof typed.T>;

export const accepted: Props[] = [
  { key: 'greeting', params: { name: 'Ann' } },
  { key: 'hint' },
  { key: 'plain', locale: 'en', components: { emphasis: 'i', image: null } },
  { key: 'loose', params: { x: 1 } },
];

export const rejected: Props[] = [
  // @ts-expect-error -- a key outside the schema
  { key: 'nope' },
  // @ts-expect-error -- a required payload left out
  { key: 'greeting' },
  // @ts-expect-error -- a payload of the wrong shape
  { key: 'greeting', params: { nome: 'Ann' } },
  // @ts-expect-error -- a key that takes no payload
  { key: 'plain', params: { name: 'Ann' } },
  // @ts-expect-error -- a trailing param of the wrong shape
  { key: 'hint', args: [{ strict: 'yes' }] },
  // @ts-expect-error -- a node Markdown has not
  { key: 'plain', components: { b: 'strong' } },
];

const strict: Parser.T<[payload: Record<string, unknown>, options: { strict: boolean }]> = { parse: (text) => String(text) };

export const required = new I18n({ initLocale: 'en', parser: strict, schema: {} as Schema, extensions: [markdown({ onReport: null })] });

export const trailing: ComponentProps<typeof required.T>[] = [
  { key: 'plain', params: undefined, args: [{ strict: true }] },
  { key: 'greeting', params: { name: 'Ann' }, args: [{ strict: true }] },
  // @ts-expect-error -- a required trailing param left out
  { key: 'plain', params: undefined },
];

const replaced = new I18n({ parser, extensions: [(i18n: I18n) => ({ instance: i18n }), markdown({ onReport: null })] });

// @ts-expect-error -- an extension that replaced the instance leaves no `T`
export const missing = replaced.T;
