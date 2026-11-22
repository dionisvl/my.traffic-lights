<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '#lib/client.js';
  let adult=$state(false), raw=$state(''), files=$state([]), error=$state(''), busy=$state(false);
  onMount(() => { api('/api/questions').then(data => files=data.files).catch(e => error=e.message); });
  async function load(name) { try { raw=(await api('/api/questions/'+encodeURIComponent(name))).content; error=''; } catch(e) { error=e.message; } }
  async function create() {
    if (!adult || busy || !raw.trim()) return;
    busy=true; error='';
    try {
      const {gameId}=await api('/api/game',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({questions:raw.split('\n').map(x=>x.trim()).filter(Boolean)})});
      await goto('/game/'+gameId);
    } catch(e) { error=e.message; } finally { busy=false; }
  }
</script>
<svelte:head><title>Traffic Lights — Create Game</title></svelte:head>
<main class="container">
  <h1>Traffic Lights — Create Game</h1>
  <label class="row"><input type="checkbox" bind:checked={adult} /> I'm 18+</label>
  <textarea bind:value={raw} rows="8" placeholder="Enter questions, one per line"></textarea>
  {#if files.length}<div class="server-files">Or pick from server files: <div class="row wrap">{#each files as f (f.name)}<button class="secondary" onclick={() => load(f.name)}>{f.name}</button>{/each}</div></div>{/if}
  <div class="row"><button disabled={!adult || !raw.trim() || busy} onclick={create}>Create Game</button></div>
  {#if error}<p role="alert">{error}</p>{/if}
</main>

<style>

.container {
  max-width: 720px;
  margin: 2rem auto;
  display: grid;
  gap: 1.5rem;
  padding: 2rem;
  background-color: #f9f9f9;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #333;
}

h1 {
  text-align: center;
  color: #2c3e50;
  font-size: 2.2em;
}

.row {
  display: flex;
  align-items: center;
  gap: .75rem;
}

.wrap { flex-wrap: wrap; }

textarea {
  width: 100%;
  padding: 0.8rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 1em;
  min-height: 120px;
  resize: vertical;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: border-color 0.3s ease;
}

textarea:focus {
  border-color: #007bff;
  outline: none;
}

button {
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 8px;
  background-color: #007bff;
  color: white;
  font-size: 1.1em;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.1s ease;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.secondary {
  background: #e9ecef;
  color: #333;
}

.server-files {
  display: grid;
  gap: .5rem;
}

.muted { color: #666; font-size: .9em; }

button:hover {
  background-color: #0056b3;
  transform: translateY(-1px);
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

input[type="checkbox"] {
  width: 1.2em;
  height: 1.2em;
  accent-color: #007bff;
}

p.row {
  background-color: #e9ecef;
  padding: 0.8rem 1.2rem;
  border-radius: 8px;
  word-break: break-all;
  font-size: 0.95em;
  color: #555;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
}

p.row span {
  flex-grow: 1;
}

.row NuxtLink {
  color: #007bff;
  text-decoration: none;
  font-weight: bold;
}

.row NuxtLink:hover {
  text-decoration: underline;
}

</style>
