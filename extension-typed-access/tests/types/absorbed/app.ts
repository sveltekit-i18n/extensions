import I18n from '@sveltekit-i18n/base';
import typedAccess from '@sveltekit-i18n/extension-typed-access';

const i18n = new I18n({ parser: { parse: (value: any) => value }, extensions: [typedAccess] });

i18n.t.cms.extra({ n: 1 });
// @ts-expect-error a required payload
i18n.t.cms.extra();
// @ts-expect-error a payload of the declared type
i18n.t.cms.extra({ n: 'x' });
i18n.t.cms.anything();
i18n.t.common.hi({ name: 'x' });
