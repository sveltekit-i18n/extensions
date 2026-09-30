// A library that exports outputs of the extension. Its declarations are
// emitted into ./dist and the consumer in app.ts reads only those.
import I18n from '@sveltekit-i18n/base';
import type { Extension, I18n as I18nType } from '@sveltekit-i18n/base';
import typedAccess from '@sveltekit-i18n/extension-typed-access';

type S = { 'common.hi': { name: string }; 'prototype.x': never };
type Any = I18nType<any, any, any, any>;
type Replaced<I> = Extract<I, Any> & { instance: Extract<I, Any> };

interface Add extends Extension.Operator {
  readonly output: Extract<this['input'], Any> & { extra: number };
}
interface Tag extends Extension.Operator {
  readonly output: Extract<this['input'], Any> & { tag?: string };
}
interface Forward extends Extension.Operator {
  readonly output: Replaced<this['input']>;
}

const parser = { parse: (value: any) => value };
const tag = ((i18n: any) => i18n) as Extension.Generic<Tag>;
const add = ((i18n: any) => Object.assign(i18n, { extra: 1 })) as Extension.Generic<Add>;
const forward = ((i18n: any) => ({ ...i18n, instance: i18n })) as Extension.Generic<Forward>;

export const typed = new I18n({ parser, schema: {} as S, extensions: [typedAccess] });
export const twice = new I18n({ parser, schema: {} as S, extensions: [typedAccess, typedAccess] });
// A generic schema leaves the tree deferred, so only a name keeps it out of the declarations.
export const create = <Schema>(schema: Schema) => new I18n({ parser, schema, extensions: [typedAccess] });
export const tagged = new I18n({ parser, schema: {} as S, extensions: [tag, typedAccess] });
export const added = new I18n({ parser, extensions: [typedAccess, add] });
export const layered = new I18n({
  parser,
  schema: {} as S,
  extensions: [typedAccess, forward, typedAccess, forward, typedAccess, forward, typedAccess],
});
