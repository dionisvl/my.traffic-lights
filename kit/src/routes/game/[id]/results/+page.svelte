<script lang="ts">
  import ResultsPage from '#lib/game/ResultsPage.svelte';
  let { data } = $props();
</script>

<ResultsPage {data} />
