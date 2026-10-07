<script lang="ts">
  import type { Component } from 'svelte';

  const { T }: { T: Component<{ key: string }> } = $props();
</script>
<T key="common.rich" />
