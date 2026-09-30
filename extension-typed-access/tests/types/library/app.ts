import type { I18n, Parser } from '@sveltekit-i18n/base';
import stores from '@sveltekit-i18n/extension-stores';
import typedAccess from '@sveltekit-i18n/extension-typed-access';
import type { Wrapped } from '@sveltekit-i18n/extension-typed-access';

import { added, create, layered, tagged, twice, typed } from './dist/lib.js';

type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends (<X>() => X extends B ? 1 : 2) ? true : false;
const equal = <A, B>(_: Equal<A, B>) => {};
const isAny = <T>(_: 0 extends 1 & T ? true : false) => {};

// Declaration emit spells the optional mark with `undefined`, which
// `exactOptionalPropertyTypes` keeps: each output is still handed back.
equal<ReturnType<typeof typedAccess<typeof typed>>, typeof typed>(true);
equal<ReturnType<typeof typedAccess<typeof added>>, typeof added>(true);
equal<ReturnType<typeof typedAccess<typeof layered>>, typeof layered>(true);

// The same object as `typed` at runtime, and interchangeable with it once
// emitted, although the emit names one and spells the other out.
const once: typeof twice = typed;
const again: typeof typed = twice;

// The output stays an instance, so an extension after it still reads the schema.
const instance: I18n<any, any, any, any> = typed;
const withStores = stores(typed);
isAny<typeof withStores>(false);

typed.t.common.hi({ name: 'x' });
typed.t.prototype.x();
// @ts-expect-error `instance` is the core, whose t has no tree
typedAccess(typed).instance.t.common.hi({ name: 'x' });
typedAccess(added).extra.toFixed();
// Spelled out once emitted, as another extension followed; still an output.
const output: Wrapped<I18n<Parser.Params, string, never, string>> = added;
layered.t.common.hi({ name: 'x' });
layered.instance.instance.t.common.hi({ name: 'x' });
// @ts-expect-error the key set stays closed
layered.instance.t.common.nope();

const created = create({} as { 'common.hi': { name: string } });

created.t.common.hi({ name: 'x' });
// @ts-expect-error the key set stays closed
created.t.common.nope();
// @ts-expect-error a payload is required
created.t.common.hi();

void once;
void output;
void again;
void instance;
void withStores;

// An optional member an extension before this one added stays on `instance`.
tagged.instance.tag?.toUpperCase();
