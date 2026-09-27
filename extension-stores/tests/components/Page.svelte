<script lang="ts">
  import type { Output } from '../../src';

  const { locale, initialized, translations, t }: Output = $props();
</script>

<p>{$locale}|{$initialized}|{$translations[$locale]?.['common.hi']}|{$t('common.hi')}</p>
