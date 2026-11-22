<script lang="ts">
  import type { GameView } from '../../../../../game.ts';
  import { onMount } from 'svelte';
  import { api } from '#lib/client.js';
  import Results from '#lib/Results.svelte';
  let {data}: {data: {gameId: string}}=$props();
  let result=$state<GameView | null>(null),error=$state('');
  onMount(()=>{api('/api/game/'+data.gameId).then(x=>result=x).catch(e=>error=e.message);});
</script>
<main><h1>Результаты</h1>
{#if error}<p role="alert">{error}</p>{:else if result?.game.status==='completed'}<Results answers={result.answers} />{:else if result}<p>Game not completed.</p>{:else}<p>Загрузка…</p>{/if}
<a href={'/game/'+data.gameId}>Back to game</a></main>
<style>main{max-width:960px;margin:2rem auto;padding:1rem}</style>
