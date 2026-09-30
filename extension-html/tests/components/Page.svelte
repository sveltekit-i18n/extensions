<script lang="ts">
  import type { Component } from 'svelte';

  // Loosely typed on purpose: the specs drive every prop combination, and the
  // typing of `T` is asserted in `Typed.svelte`.
  const { i18n, props }: { i18n: { T: Component<any> }; props: Record<string, unknown> } = $props();
</script>

<i18n.T {...props} />
