// What `@sveltekit-i18n/typegen` writes: a global script, no import or export.
interface TranslationSchema {
  'home.title': never;
  'cart.summary.itemCount': { count: number };
  [key: `cms.${string}`]: any;
}

declare namespace SvelteKitI18n { interface Register { schema: TranslationSchema } }
