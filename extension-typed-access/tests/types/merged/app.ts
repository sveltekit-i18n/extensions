import I18n from '@sveltekit-i18n/base';
import typedAccess from '@sveltekit-i18n/extension-typed-access';

const i18n = new I18n({ parser: { parse: (value: any) => value }, extensions: [typedAccess] });

i18n.t.extra.key({ n: 1 });
// @ts-expect-error a required payload
i18n.t.extra.key();
i18n.t.dyn.anything();
i18n.t.common.hi({ name: 'x' });
i18n.t.cms.page.body();
// @ts-expect-error an unknown key
i18n.t.common.nope();
