import I18n from '@sveltekit-i18n/base';
import typedAccess from '@sveltekit-i18n/extension-typed-access';

const parser = { parse: (value: any) => value };
const i18n = new I18n({ parser, extensions: [typedAccess] });

i18n.t.dyn.anything();
i18n.t.cms.anything();
i18n.t.common.hi({ name: 'x' });

// The generated literal keys without the patterns: no namespace is open.
type IsPattern<K extends string> = Record<never, never> extends Record<K, 1> ? true : false;
type Closed = { [K in keyof TranslationSchema as K extends string ? IsPattern<K> extends true ? never : K : never]: TranslationSchema[K] };

const closed = new I18n({ parser, schema: {} as Closed, extensions: [typedAccess] });

closed.t.cms.title({ x: 1 });
// @ts-expect-error a key the schema does not hold
closed.t.cms.anything();
