import { I18n } from '@sveltekit-i18n/base';
import type { Parser } from '@sveltekit-i18n/base';
import type { ComponentProps } from 'svelte';

import markdown from '../../src';

// The probe `tests/specs/cost.spec.ts` counts the checker's work in, call by
// call. Never run.

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

/** `v…` keys take no payload, `o…` an optional one and `r…` a required one. */
type Probe<N extends string> = {
  [K in N]: K extends `ns.v${string}` ? void : K extends `ns.o${string}` ? { name?: string } : { name: string }
};

type Small = Probe<`ns.${'v' | 'o' | 'r'}${Digit}`>;
type Large = Probe<`ns.${'v' | 'o' | 'r'}${Digit}${Digit}`>;
/** No key renders without a payload. */
type StrictSmall = Probe<`ns.r${Digit}`>;
type StrictLarge = Probe<`ns.r${Digit}${Digit}`>;

const parser: Parser.T<[payload?: Record<string, unknown>, options?: { strict: boolean }]> = { parse: (text) => String(text) };

const small = new I18n({ parser, schema: {} as Small, extensions: [markdown({ onReport: null })] });
const large = new I18n({ parser, schema: {} as Large, extensions: [markdown({ onReport: null })] });
const strictSmall = new I18n({ parser, schema: {} as StrictSmall, extensions: [markdown({ onReport: null })] });
const strictLarge = new I18n({ parser, schema: {} as StrictLarge, extensions: [markdown({ onReport: null })] });

declare function renderSmall(props: ComponentProps<typeof small.T>): void;
declare function renderLarge(props: ComponentProps<typeof large.T>): void;
declare function renderStrictSmall(props: ComponentProps<typeof strictSmall.T>): void;
declare function renderStrictLarge(props: ComponentProps<typeof strictLarge.T>): void;

/** Props as a union of intersections, which TypeScript tries member by member. */
type Control<S> = { [K in keyof S & string]: { key: K } & { params: S[K] } }[keyof S & string];

declare function controlSmall(props: Control<Small>): void;
declare function controlLarge(props: Control<Large>): void;

// What a schema costs once, before the calls measured.
renderSmall({ key: 'ns.r0', params: { name: 'x' } });
renderLarge({ key: 'ns.r00', params: { name: 'x' } });
renderSmall({ key: 'ns.v0' });
renderLarge({ key: 'ns.v00' });
renderStrictSmall({ key: 'ns.r0', params: { name: 'x' } });
renderStrictLarge({ key: 'ns.r00', params: { name: 'x' } });
controlSmall({ key: 'ns.r0', params: { name: 'x' } });
controlLarge({ key: 'ns.r00', params: { name: 'x' } });

// The last keys of each kind: a search member by member reaches them last.
renderSmall({ key: 'ns.r9', params: { name: 'x' } });
renderLarge({ key: 'ns.r99', params: { name: 'x' } });
renderSmall({ key: 'ns.v9' });
renderLarge({ key: 'ns.v99' });
renderSmall({ key: 'ns.v8', args: [{ strict: true }] });
renderLarge({ key: 'ns.v98', args: [{ strict: true }] });
renderStrictSmall({ key: 'ns.r9', params: { name: 'x' } });
renderStrictLarge({ key: 'ns.r99', params: { name: 'x' } });
controlSmall({ key: 'ns.r9', params: { name: 'x' } });
controlLarge({ key: 'ns.r99', params: { name: 'x' } });
