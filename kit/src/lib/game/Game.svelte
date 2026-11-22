<script lang="ts">
  import type { GameView } from './domain.ts';
  import { onMount } from 'svelte';
  import { io, type Socket } from 'socket.io-client';
  import { identity } from './client.js';
  import Results from './Results.svelte';
  let { data }: {data: {gameId: string}}=$props();
  let snapshot=$state<GameView | null>(null), joined=$state(false), error=$state(''), comment=$state(''), copied=$state(false), busy=$state(false);
  let socket: Socket | undefined;
  let index=-1, savedComment='';
  const choices=[['green','🟢 Yes'],['yellow','🟡 Maybe'],['red','🔴 No']];
  let current=$derived(snapshot?.answers.find(a=>a.questionIndex===snapshot?.game.currentQuestionIndex));
  let me=$derived(snapshot?.role==='p1' ? current?.player1 : current?.player2);
  let partner=$derived(snapshot?.role==='p1' ? current?.player2 : current?.player1);
  let partnerOnline=$derived(snapshot?.players[snapshot.role==='p1' ? 'p2' : 'p1']?.online);
  let roundStatus=$derived(!joined ? (error ? 'Disconnected.' : 'Reconnecting…') : me?.ready
    ? (partnerOnline ? 'Waiting for the other player…' : 'The other player is offline.')
    : !me?.answer ? 'Choose an answer.' : partner?.ready ? 'The other player is ready.' : 'Add a comment or mark yourself ready.');
  function update(next: GameView) {
    const i=next.game.currentQuestionIndex;
    const row=next.answers.find(a=>a.questionIndex===i);
    const nextComment=(next.role==='p1'?row?.player1:row?.player2)?.comment ?? '';
    if(i!==index || comment===savedComment) comment=nextComment;
    index=i; savedComment=nextComment; snapshot=next;
  }
  onMount(() => {
    const connection=io({transports:['websocket'],auth:{playerId:identity()}}); socket=connection;
    let generation=0;
    connection.on('connect', async () => {
      const attempt=++generation;
      try {
        const reply=await connection.timeout(4000).emitWithAck('join_game',{gameId:data.gameId});
        if(!connection.connected || attempt!==generation) return;
        if(!reply.ok) throw new Error(reply.error);
        update(reply.snapshot); joined=true; error='';
      } catch(e) { if(attempt===generation) error=e instanceof Error ? e.message : String(e); }
    });
    connection.on('disconnect',()=>{++generation; joined=false;});
    connection.on('connect_error',()=>{joined=false;});
    connection.on('snapshot',state=>{if(joined) update(state);});
    return () => {++generation; connection.close();};
  });
  async function send(event: string, fields: {ready?: boolean; answer?: string; comment?: string}={}) {
    const connection=socket;
    if(!connection?.connected || !joined || busy) return;
    busy=true; error='';
    const questionIndex=index;
    try {
      const sendEvent=async(name: string, payload: typeof fields)=>{
        const reply=await connection.timeout(4000).emitWithAck(name,{gameId:data.gameId,questionIndex,...payload});
        if(!reply.ok) throw new Error(reply.error);
        return reply;
      };
      if(event==='ready_next' && fields.ready && comment!==savedComment) await sendEvent('submit_comment',{comment});
      await sendEvent(event, fields);
    } catch(e) {error=e instanceof Error ? e.message : String(e);} finally {busy=false;}
  }
  async function share() {
    try { if(navigator.share) await navigator.share({url:location.href}); else await copy(); }
    catch(e) { if(!(e instanceof Error && e.name==='AbortError')) error=e instanceof Error ? e.message : String(e); }
  }
  async function copy() { try { await navigator.clipboard.writeText(location.href); copied=true; } catch(e) { error=e instanceof Error ? e.message : String(e); } }
</script>
<svelte:head><title>Traffic Lights Game</title></svelte:head>
<main class="container">
  <header class="row"><div class="brand row"><a href="/" class="brand-link" aria-label="Home">🚦</a><h1>Traffic Lights Game</h1></div>
  {#if snapshot}<span><b>P1:</b> {snapshot.players.p1.online?'Online':'Offline'} · <b>P2:</b> {snapshot.players.p2.online?'Online':'Offline'}</span>{/if}</header>
  {#if !joined && !error && snapshot?.game.status!=='in_progress'}<p role="status">{snapshot ? 'Reconnecting…' : 'Connecting…'}</p>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
  {#if !snapshot || snapshot.game.status==='waiting'}
    <p>A realtime two-player game for couples and friends. Answer the same questions with 🟢 Yes, 🟡 Maybe, or 🔴 No. Compare your answers after each round and talk about what surprised you.</p>
  {/if}
  {#if snapshot?.game.status==='waiting'}
    {#if snapshot.role==='p1'}
      {#if !snapshot.players.p2.online}<p>Waiting for Player 2 to connect. Once Player 2 is online, you can start the game.</p>{/if}
      <div class="row"><button onclick={copy}>Copy link</button><button onclick={share}>Share…</button>{#if copied}<span>Link copied</span>{/if}</div>
      <button disabled={!joined || busy || !snapshot.players.p2.online} onclick={() => send('start_game')}>Start Game</button>
    {:else}<p>Waiting for game to start...</p>{/if}
  {:else if snapshot?.game.status==='in_progress' && current}
    <section class="card">
      <h3>Question {snapshot.game.currentQuestionIndex+1} of {snapshot.game.total}</h3><h2>{current.questionText}</h2>
      <div class="choices">{#each choices as [color,title] (color)}<button class={me?.answer===color?color:''} disabled={!joined} aria-disabled={busy} aria-pressed={me?.answer===color} onclick={() => send('choose_answer',{answer:color})}>{title}</button>{/each}</div>
      <textarea maxlength="2000" rows="2" placeholder="Comment" aria-label="Comment" bind:value={comment} disabled={!joined || Boolean(me?.ready)}></textarea>

    </section>
  {/if}
  {#if snapshot && snapshot.game.status!=='waiting'}
    <section class="results"><h3>Results</h3><Results answers={snapshot.answers} /></section>
  {/if}
  {#if snapshot?.game.status==='in_progress' && current}
    <div class="round-actions">
      <p class="round-status" role="status">{roundStatus}</p>
      <button type="button" class="round-ready" class:ready={Boolean(me?.ready)} disabled={!joined || !me?.answer} aria-disabled={busy} onclick={() => send('ready_next',{ready:!me?.ready})}>{me?.ready ? 'Cancel ready' : 'Ready'}</button>
    </div>
  {/if}
  {#if snapshot?.game.status==='completed'}<p>Game completed - all questions have been answered</p><a href={'/game/'+data.gameId+'/results'}>Open results</a>{/if}
</main>

<style>

.container {
  max-width: 720px;
  margin: 1rem auto;
  display: grid;
  gap: 1.5rem;
  padding: 1rem;
  background-color: #f9f9f9;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #333;
  min-height: calc(40vh - 2rem);
  box-sizing: border-box;
}

@media (max-width: 768px) {
  .container {
    margin: 0.5rem;
    padding: 1rem;
    border-radius: 8px;
    gap: 1rem;
    min-height: calc(40vh - 1rem);
  }
}

header {
  text-align: center;
  font-size: 1.1em;
  color: #555;
}

@media (max-width: 768px) {
  header {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
    font-size: 0.9em;
  }


  header .brand {
    justify-content: center;
  }

  header .brand h1 {
    font-size: 1.2em;
    margin: 0;
  }
}

.brand {
  gap: .5rem;
}

.brand-link {
  font-size: 1.8rem;
  text-decoration: none;
  line-height: 1;
}


.row {
  display: flex;
  align-items: center;
  gap: .75rem;
}

.between {
  justify-content: space-between;
}

.card {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 1.5rem;
  background-color: #ffffff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.card h2 {
  text-align: center;
  font-size: 1.8em;
  color: #2c3e50;
}

.choices {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.choices button {
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 8px;
  color: #000000;
  font-size: 1.1em;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.2s ease;
  flex-grow: 1;
  max-width: 180px;
  margin-bottom: 1.5rem;
}

.choices button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.choices button.red { background: #e74c3c; }
.choices button.red:hover { background: #c0392b; }
.choices button.red.red { box-shadow: 0 0 0 3px #e74c3c; }

.choices button.yellow { background: #f1c40f; }
.choices button.yellow:hover { background: #f39c12; }
.choices button.yellow.yellow { box-shadow: 0 0 0 3px #f1c40f; }

.choices button.green { background: #2ecc71; }
.choices button.green:hover { background: #27ae60; }
.choices button.green.green { box-shadow: 0 0 0 3px #2ecc71; }

@media (max-width: 768px) {
  .choices {
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
  }

  .choices button {
    padding: 1rem;
    font-size: 1.2em;
    max-width: none;
    margin-bottom: 0;
    min-height: 50px;
  }

  .card {
    padding: 1rem;
  }

  .card h2 {
    font-size: 1.5em;
    margin-bottom: 1rem;
  }

  .card h3 {
    font-size: 1.1em;
    margin-bottom: 0.5rem;
  }
}

textarea {
  width: 100%;
  padding: 0.8rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 1em;
  min-height: 40px;
  resize: vertical;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: border-color 0.3s ease;
}

textarea:focus {
  border-color: #007bff;
  outline: none;
}



.hint {
  color: #777;
  font-size: 0.9em;
  text-align: center;
  margin-top: 1rem;
}


.round-actions {
  position: sticky;
  bottom: 0;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: .5rem 1rem;
  padding: .75rem;
  background: #fff;
  border: 1px solid #dfe4ea;
  border-radius: .75rem;
}
.round-status { margin: 0; color: #465164; }
.round-ready { min-height: 44px; }
.round-ready[aria-disabled="true"] { opacity: .65; }
.card :is(textarea, button) { scroll-margin-bottom: 8rem; }
.round-ready.ready { background: #fff; color: #173e68; border: 1px solid #173e68; }
@media (max-width: 640px) {
  .round-actions { display: grid; gap: .4rem; padding-bottom: max(.75rem, env(safe-area-inset-bottom)); }
  .round-ready { width: 100%; }
}

.share-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
}

.link-share {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
  max-width: 400px;
}

.link-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 0.85em;
  background-color: #f9f9f9;
  color: #555;
  min-width: 0;
}

.copy-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  background-color: #007bff;
  color: white;
  cursor: pointer;
  font-size: 0.9em;
  white-space: nowrap;
  transition: background-color 0.2s ease;
}

.copy-btn:hover {
  background-color: #0056b3;
}

.copy-feedback {
  color: #2ecc71;
  font-size: 0.9em;
  font-weight: 500;
}

.share-btn {
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 6px;
  background-color: #6c757d;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.share-btn:hover {
  background-color: #5a6268;
}

@media (max-width: 768px) {
  .link-share {
    max-width: 100%;
  }

  .link-input {
    font-size: 0.8em;
  }

  .copy-btn {
    padding: 0.6rem 0.8rem;
    font-size: 0.85em;
  }
}


.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0,0,0,0.15);
  border-top-color: #007bff;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
  vertical-align: middle;
  margin-right: 6px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.results {
  margin-top: 2rem;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  padding: 1.5rem;
}

.results h3 {
  text-align: center;
  color: #2c3e50;
  font-size: 1.6em;
}





@media (max-width: 768px) {
  .results {
    padding: 1rem;
    margin-top: 1rem;
    overflow-x: auto;
  }

  .results h3 {
    font-size: 1.3em;
    margin-bottom: 1rem;
  }





}




.status-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 5px;
  vertical-align: middle;
}

.status-indicator.online {
  background-color: #2ecc71;
}

.status-indicator.offline {
  background-color: #e74c3c;
}


.question-slide-enter-active,
.question-slide-leave-active {
  transition: all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.question-slide-enter-from {
  transform: translateY(-30px);
  opacity: 0;
}

.question-slide-leave-to {
  transform: translateY(30px);
  opacity: 0;
}

.question-container {
  will-change: transform, opacity;
}

.comment-section {
  margin-top: 1rem;
}

.partner-status {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
}

.partner-comment {
  font-style: italic;
  color: #555;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 6px;
  max-width: 300px;
  word-wrap: break-word;
}

</style>
