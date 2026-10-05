// What `@sveltekit-i18n/typegen` 3.0 writes: a global script, no import or export,
// and no tree, so the keys are grouped here.
interface TranslationSchema {
  'home.title': never;
  'cart.summary.itemCount': { count: number };
  [key: `cms.${string}`]: any;
}

declare namespace SvelteKitI18n { interface Register { schema: TranslationSchema } }
