import I18n from '@sveltekit-i18n/base';
import { defineI18n } from '@sveltekit-i18n/base/kit';
import typedAccess from '@sveltekit-i18n/extension-typed-access';

const parser = { parse: (value: any) => value };
const i18n = new I18n({ parser, extensions: [typedAccess] });

i18n.t.home.title();
i18n.t.cart.summary.itemCount({ count: 3 });
i18n.t.cms.page.body();
// @ts-expect-error a required payload
i18n.t.cart.summary.itemCount();
// @ts-expect-error an unknown key
i18n.t.home.nope();

const kit = defineI18n({ parser, loaders: [], extensions: [typedAccess] });

kit.get().t.cart.summary.itemCount({ count: 1 });
// @ts-expect-error a payload of another shape
kit.get().t.cart.summary.itemCount({});
