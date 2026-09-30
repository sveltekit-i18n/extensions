<script lang="ts">
  import type { Output } from '../../src';

  const { t, user }: Output & { user: { name: string } } = $props();
</script>

<p>{$t('common.greet', user)}</p>
