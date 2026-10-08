import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Workaround for vite-plugin-svelte 7.3 on rolldown-vite 8: the plugin
// assigns its module-compile `transform.filter` in `configResolved`, which
// the native filter pipeline snapshots too early — rune modules then reach
// the runtime uncompiled ("$state is not defined"). A filter-less transform
// forces the JS plugin pipeline, where the late-bound filter is honoured.
// Remove once the plugin registers its filter statically.
const forceJsPluginPipeline = { name: 'force-js-plugin-pipeline', transform() {} };

// Both must go through the vite pipeline rather than node's own resolution:
// base for the compile of its rune modules, svelte for the conditions below.
const inline = ['@sveltekit-i18n/base', /\/svelte\//, /^svelte$/];

const SERVER_SPEC = 'tests/specs/server.spec.ts';

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [svelte(), forceJsPluginPipeline],
        resolve: {
          // vitest resolves with node-flavoured conditions even in a DOM
          // environment, which would pick svelte's server runtime; `browser`
          // first keeps the client one.
          conditions: ['browser', 'svelte', 'development|production', 'module', 'import', 'default'],
          // Two svelte copies would be two reactivity runtimes that cannot
          // track each other.
          dedupe: ['svelte'],
        },
        test: {
          name: 'client',
          environment: 'happy-dom',
          include: ['tests/specs/**/*.spec.ts'],
          exclude: [SERVER_SPEC],
          server: { deps: { inline } },
        },
      },
      {
        // What a server render sees: the components and the rune modules
        // compiled for the server, and the server build of `svelte`.
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
