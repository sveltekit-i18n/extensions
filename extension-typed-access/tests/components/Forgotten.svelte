<script lang="ts">
  // A forgotten call, untyped: the types reject it where a schema closes the tree.
  const { i18n }: { i18n: any } = $props();
</script>
<span title="z {i18n.t.common.hi}">{i18n.t.common.hi}</span>
