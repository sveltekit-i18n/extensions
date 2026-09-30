<script lang="ts">
  import type { Snippet } from 'svelte';

  const { children }: { children?: Snippet } = $props();
</script>

<td class="cell">{@render children?.()}</td>
