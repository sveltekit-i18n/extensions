// A key an app declares itself under a namespace typegen left open: `keyof`
// loses it to the pattern, so only the literal keys tell it apart.
interface TranslationSchema {
  'cms.extra': { n: number };
}
