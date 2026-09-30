<script lang="ts">
  import type { Output } from '../../src';
  import type { I18n } from '@sveltekit-i18n/base';

  type Schema = { 'common.hi': never };
  const { i18n }: { i18n: Output<I18n<any, string, Schema, string>> } = $props();
  const { t } = $derived(i18n);
</script>
<p>{i18n.locale}|{i18n.t.common.hi()}|{t.common.hi()}|{i18n.t('common.hi')}</p>
