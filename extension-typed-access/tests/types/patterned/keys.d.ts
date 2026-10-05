// A pattern an app declares itself beside a tree with patterns of its own:
// the literal keys are the generated ones, the patterns are not.
interface TranslationSchema {
  [key: `dyn.${string}`]: any;
}
