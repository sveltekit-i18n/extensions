import { I18n } from '@sveltekit-i18n/base';
import stores from '@sveltekit-i18n/extension-stores';

const parser = { parse: (value: string) => value };

const output = stores(new I18n({ parser }));
const piped = new I18n({ parser, extensions: [stores] });

// @ts-expect-error a core without `preload()` has no member to pass through
void output.preload('en');

export const direct: undefined = output.preload;
export const throughPipe: undefined = piped.preload;
