<script lang="ts">
  const { first }: { first: () => Promise<number> } = $props();
</script>

<p>{(await first()) + (await Promise.resolve(1))}</p>
