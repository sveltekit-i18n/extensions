<script lang="ts">
  import type { Snippet } from 'svelte';

  const { href, rel, children }: { href?: string; rel?: string; children?: Snippet } = $props();
</script>

<a data-link {href} {rel}>{@render children?.()}</a>
