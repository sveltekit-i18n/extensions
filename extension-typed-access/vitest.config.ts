import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Workaround for vite-plugin-svelte 7.3 on rolldown-vite 8: the plugin
// assigns its module-compile `transform.filter` in `configResolved`, which
// the native filter pipeline snapshots too early — rune modules then reach
// the runtime uncompiled ("$state is not defined"). A filter-less transform
// forces the JS plugin pipeline, where the late-bound filter is honoured.
// Remove once the plugin registers its filter statically.
const forceJsPluginPipeline = { name: 'force-js-plugin-pipeline', transform() {} };

const SERVER_SPEC = 'tests/specs/server.spec.ts';

// Everything must go through the vite pipeline (not node's own resolution):
// base and extension-stores ship rune modules uncompiled, and svelte needs
// the browser-condition resolve in the client project.
const inline = ['@sveltekit-i18n/base', '@sveltekit-i18n/extension-stores', /\/svelte\//, /^svelte$/];

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [svelte(), forceJsPluginPipeline],
        resolve: {
          // `svelte` splits its exports on the browser/default conditions, and
          // vitest resolves with node-flavoured conditions even in its client
          // environment — which would pick the server variant, whose effects
          // never run. Put `browser` first, keeping the standard client
          // fallbacks.
          conditions: ['browser', 'svelte', 'development|production', 'module', 'import', 'default'],
          // Every import must land on this package's single svelte copy — two
          // copies would mean two reactivity runtimes that cannot track each
          // other.
          dedupe: ['svelte'],
        },
        test: {
          name: 'client',
          environment: './tests/environment.ts',
          include: ['tests/specs/**/*.spec.ts'],
          exclude: [SERVER_SPEC],
          server: { deps: { inline } },
        },
      },
      {
        // What a server render sees: the rune modules compiled for the
        // server, and the server build of `svelte`.
        plugins: [
          svelte({ dynamicCompileOptions: () => ({ generate: 'server' }) }),
          forceJsPluginPipeline,
        ],
        resolve: { dedupe: ['svelte'] },
        test: {
          name: 'server',
          environment: 'node',
          include: [SERVER_SPEC],
          server: { deps: { inline } },
        },
      },
    ],
  },
});
