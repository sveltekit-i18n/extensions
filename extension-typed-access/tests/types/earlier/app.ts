import { I18n } from '@sveltekit-i18n/base';
import typedAccess from '@sveltekit-i18n/extension-typed-access';

const parser = { parse: (value: string) => value };

const output = typedAccess(new I18n({ parser }));
const piped = new I18n({ parser, extensions: [typedAccess] });

// @ts-expect-error a core without `preload()` has no member to pass through
void output.preload;
// @ts-expect-error a core without `preload()` has no member to pass through
void piped.preload;
