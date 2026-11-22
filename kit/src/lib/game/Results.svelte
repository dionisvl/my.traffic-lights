<script lang="ts">
  import type { AnswerRow, VisibleAnswer } from './domain.ts';
  let { answers = [] }: { answers?: AnswerRow[] } = $props();
  const labels = { green: '🟢 Yes', yellow: '🟡 Maybe', red: '🔴 No' };
</script>

{#snippet player(label: string, entry: VisibleAnswer)}
  <span class="mobile-label" aria-hidden="true">{label}</span>
  <span class="answer">{entry.answer ? labels[entry.answer] : '—'}</span>
  {#if entry.comment}<p class="comment">{entry.comment}</p>{/if}
{/snippet}

<table role="table" aria-label="Game results">
  <colgroup><col class="number" /><col class="question" /><col /><col /></colgroup>
  <thead role="rowgroup">
    <tr role="row"><th role="columnheader" scope="col">#</th><th role="columnheader" scope="col">Question</th><th role="columnheader" scope="col">Player 1</th><th role="columnheader" scope="col">Player 2</th></tr>
  </thead>
  <tbody role="rowgroup">
    {#each answers as answer (answer.questionIndex)}
      <tr role="row">
        <td role="cell" class="index">{answer.questionIndex + 1}</td>
        <th role="rowheader" scope="row" class="prompt">{answer.questionText}</th>
        <td role="cell" class="player">{@render player('Player 1', answer.player1)}</td>
        <td role="cell" class="player">{@render player('Player 2', answer.player2)}</td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  table { width: 100%; table-layout: fixed; border-collapse: collapse; }
  .number { width: 3rem; }
  .question { width: 40%; }
  th, td { border: 1px solid #ddd; padding: .65rem; text-align: left; vertical-align: top; }
  thead th { background: #f5f7fa; white-space: nowrap; }
  .prompt, .comment { overflow-wrap: anywhere; }
  .prompt { font-weight: 600; }
  .answer { display: block; font-weight: 600; }
  .comment { margin: .25rem 0 0; white-space: pre-wrap; color: #465164; }
  .mobile-label { display: none; }

  @media (max-width: 640px) {
    table, tbody { display: block; }
    colgroup { display: none; }
    thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    tbody { display: grid; gap: .75rem; }
    tbody tr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); border: 1px solid #ddd; border-radius: .6rem; }
    th, td { border: 0; }
    .index, .prompt { grid-column: 1 / -1; }
    .index { padding-bottom: 0; color: #465164; font-size: .85rem; }
    .index::before { content: '#'; }
    .player { border-top: 1px solid #ddd; }
    .player + .player { border-left: 1px solid #ddd; }
    .mobile-label { display: block; margin-bottom: .25rem; color: #465164; font-size: .85rem; }
  }
</style>
