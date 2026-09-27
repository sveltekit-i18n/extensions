import { fileURLToPath } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Workaround for vite-plugin-svelte 7.3 on rolldown-vite 8: the plugin
// assigns its module-compile `transform.filter` in `configResolved`, which
// the native filter pipeline snapshots too early — rune modules then reach
// the runtime uncompiled ("$state is not defined"). A filter-less transform
// forces the JS plugin pipeline, where the late-bound filter is honoured.
// Remove once the plugin registers its filter statically.
const forceJsPluginPipeline = { name: 'force-js-plugin-pipeline', transform() {} };

// The `imports` map points into dist/; the suite runs the source of the build
// its conditions pick.
const subscribe = (file: string) => ({
  '#subscribe': fileURLToPath(new URL(`./src/${file}`, import.meta.url)),
});

const SERVER_SPEC = 'tests/specs/server.spec.ts';

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          // Compiles base's `.svelte.ts` rune modules (shipped uncompiled in
          // its dist) for the test runtime.
          svelte(),
          forceJsPluginPipeline,
        ],
        resolve: {
          // `svelte` and `svelte/store` split their exports on the
          // browser/default conditions, and vitest resolves with
          // node-flavoured conditions even in its client environment — which
          // would pick the server variants, whose stores never notify
          // subscribers. Put `browser` first, keeping the standard client
          // fallbacks.
          conditions: ['browser', 'svelte', 'development|production', 'module', 'import', 'default'],
          // Every import must land on this package's single svelte copy — two
          // copies would mean two reactivity runtimes that cannot track each
          // other.
          dedupe: ['svelte'],
          alias: subscribe('subscribe.browser.ts'),
        },
        test: {
          name: 'client',
          // Node, but with the web transform pipeline (see the comment
          // inside) so svelte compiles for the client target and
          // `svelte`/`svelte/store` resolve through the browser condition to
          // the client runtime — the server variants never notify subscribers.
          environment: './tests/environment.ts',
          include: ['tests/specs/**/*.spec.ts'],
          exclude: [SERVER_SPEC],
          server: {
            deps: {
              // Both must go through the vite pipeline (not node's own
              // resolution): base for rune compilation, svelte for the
              // browser-condition resolve.
              inline: ['@sveltekit-i18n/base', /\/svelte\//, /^svelte$/],
            },
          },
        },
      },
      {
        // What a server render sees: the rune modules compiled for the
        // server, and the server builds of `svelte` and `svelte/store`.
        plugins: [
          svelte({ dynamicCompileOptions: () => ({ generate: 'server' }) }),
          forceJsPluginPipeline,
        ],
        resolve: {
          dedupe: ['svelte'],
          alias: subscribe('subscribe.ts'),
        },
        test: {
          name: 'server',
          environment: 'node',
          include: [SERVER_SPEC],
          server: {
            deps: {
              inline: ['@sveltekit-i18n/base', /\/svelte\//, /^svelte$/],
            },
          },
        },
      },
    ],
  },
});
