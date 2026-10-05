// Keys an app declares itself, beside the ones typegen generated: the tree
// does not hold them, so the keys are grouped here instead.
interface TranslationSchema {
  'extra.key': { n: number };
  [key: `dyn.${string}`]: any;
}
