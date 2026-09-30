import { Console } from 'node:console';
import type { Environment } from 'vitest/runtime';

// The plain node environment transforms through vite's SSR pipeline, which
// makes vite-plugin-svelte compile base's rune modules for the server target —
// whose runes and stores never notify subscribers. The suite asserts on store
// emissions, so it needs node with the web (client) transform pipeline.
//
// The `setup` mirrors vitest's builtin node environment rather than spreading
// `builtinEnvironments.node`: a runtime import of `vitest/runtime` from this
// file goes through vite's client transform, which stamps the resolved
// specifier with a `?v=<hash>` query — on Windows that query is
// percent-encoded into the externalized file path and the module fails to
// resolve (ERR_MODULE_NOT_FOUND on `runtime.js%3Fv=...`).
export default {
  name: 'node-client',
  viteEnvironment: 'client',
  setup(global) {
    global.console.Console = Console;

    return {
      teardown(teardownGlobal) {
        delete teardownGlobal.console.Console;
      },
    };
  },
} satisfies Environment;
