<script lang="ts">
  import Game from '#lib/game/Game.svelte';
  let { data } = $props();
</script>

<Game {data} />
