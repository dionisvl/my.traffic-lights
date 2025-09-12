<template>
  <main class="container" v-if="state">
    <header class="row between">
      <h1>Traffic Lights Game</h1>
      <span>
        <b>P1:</b> <span :class="['status-indicator', online.p1 ? 'online' : 'offline']"></span> {{ online.p1 ? 'Online' : 'Offline' }} ·
        <b>P2:</b> <span :class="['status-indicator', online.p2 ? 'online' : 'offline']"></span> {{ online.p2 ? 'Online' : 'Offline' }}
      </span>
    </header>

    <header class="row between">
      <strong>Question {{ state.game.currentQuestionIndex + 1 }} of {{ state.game.total }}</strong>
    </header>
    <div class="row between">
      <span v-if="state.game.status==='waiting' && !isAdmin">Waiting for game to start...</span>
      <span v-if="state.game.status==='waiting' && isAdmin && !online.p2">Waiting for Player 2 to connect. Once Player 2 is online, you can start the game.</span>
    </div>

    <section class="card" v-if="state.game.status === 'in_progress'">
      <h2>{{ current.questionText }}</h2>

      <div class="choices">
        <button :class="{green: my.answer==='green'}" @click="choose('green')">🟢 Yes</button>
        <button :class="{yellow: my.answer==='yellow'}" @click="choose('yellow')">🟡 Maybe</button>
        <button :class="{red: my.answer==='red'}" @click="choose('red')">🔴 No</button>
      </div>

      <div class="row">
        <textarea v-model="my.comment" rows="3" placeholder="Comment"></textarea>
      </div>

      <label class="row">
        <input type="checkbox" v-model="my.ready" @change="handleReadyChange" /> Ready for next
      </label>

      <div class="hint">
        <span v-if="!partner.ready && partner.answer">Partner has answered</span>
        <span v-else-if="partner.ready">Partner is ready</span>
      </div>
    </section>

    <!-- Results Table -->
    <section v-if="state.game.status === 'in_progress' || state.game.status === 'completed'" class="results">
      <h3>Results</h3>
      <table>
        <thead>
          <tr>
            <th>Question</th>
            <th>Player 1</th>
            <th>Comment 1</th>
            <th>Player 2</th>
            <th>Comment 2</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(answer, idx) in answeredQuestions" :key="idx">
            <td>{{ answer.questionText }}</td>
            <td>{{ getAnswerEmoji(answer.player1.answer) }}</td>
            <td>{{ answer.player1.comment || '' }}</td>
            <td>{{ getAnswerEmoji(answer.player2.answer) }}</td>
            <td>{{ answer.player2.comment || '' }}</td>
          </tr>
        </tbody>
      </table>
    </section>


    <footer class="row between">
      <button v-if="isAdmin && state.game.status==='waiting'" @click="start">Start Game</button>
      <span v-else-if="state.game.status==='completed'">Game completed - all questions have been answered</span>
    </footer>
  </main>
  <main v-else class="container">Loading...</main>
</template>

<script setup lang="ts">
type Answer = 'red'|'yellow'|'green'
const route = useRoute()
const gameId = route.params.id as string
const state = ref<any | null>(null)
const role = ref<'p1'|'p2'|null>(null)
const online = reactive({ p1: false, p2: false })

const current = computed(() => state.value?.answers[state.value.game.currentQuestionIndex])
const my = reactive({ answer: undefined as Answer | undefined, comment: '', ready: false })
const partner = reactive({ answer: undefined as Answer | undefined, comment: '', ready: false })
const isAdmin = computed(() => role.value === 'p1')


const answeredQuestions = computed(() => {
  if (!state.value?.answers) return []
  if (state.value.game.status === 'completed') {
    // Show all questions when game is completed
    return state.value.answers
  }
  // During game, show only questions where both players answered
  return state.value.answers.filter((answer: any) => 
    answer.player1.answer && answer.player2.answer
  )
})

onMounted(async () => {
  // hydrate
  const config = useRuntimeConfig()
  const base = (config.public as any).apiBase || 'http://localhost:4000'
  state.value = await $fetch(`${base}/game/${gameId}`)
  online.p1 = state.value.players.p1.online
  online.p2 = state.value.players.p2.online
  // Join via socket
  const playerId = ensurePlayerId()
  const { connect } = useSocket()
  const s = connect()
  if (!s) return
  s.emit('join_game', { gameId, playerId })

  s.on('joined', (p: any) => { role.value = p.role; online[p.role] = true })
  s.on('player_joined', (p: any) => { online[p.player] = true })
  s.on('player_status', (p: any) => { online[p.player] = p.online })
  s.on('game_started', () => { 
    state.value.game.status = 'in_progress' 
    state.value.game.currentQuestionIndex = 0
    // If user marked ready early, re-send readiness now that game started
    if (my.ready) emit('ready_next', { ready: true })
  })
  s.on('question_show', (p: any) => { 
    state.value.game.currentQuestionIndex = p.questionIndex 
    // Re-emit readiness for current question if already marked
    if (my.ready) emit('ready_next', { ready: true })
  })
  s.on('answer_updated', async () => { await refresh() })
  s.on('comment_received', async () => { await refresh() })
  s.on('next_question', (p: any) => { 
    state.value.game.currentQuestionIndex = p.questionIndex
    // Clear comment field and ready checkbox when moving to next question
    my.comment = ''
    my.ready = false
  })
  s.on('game_completed', async () => { 
    state.value.game.status = 'completed'
    await refresh()
  })
})

// Reset ready when answer changes and notify server
watch(() => my.answer, () => { 
  if (my.ready) {
    my.ready = false
    emit('ready_next', { ready: false })
  }
})

watch(() => my.comment, (v) => { 
  if (state.value?.game.status==='in_progress') {
    emit('submit_comment', { comment: v })
    // Optimistically update local snapshot so table reflects my comment immediately
    const idx = state.value.game.currentQuestionIndex
    const snap = state.value
    if (snap && snap.answers && role.value) {
      const row = snap.answers[idx]
      if (row) {
        if (role.value === 'p1') row.player1.comment = v
        else if (role.value === 'p2') row.player2.comment = v
      }
    }
  }
  // Removed: Reset ready when comment changes
  // if (my.ready) my.ready = false
})

function handleReadyChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.checked && !my.answer) {
    // Prevent setting ready without answer
    target.checked = false
    my.ready = false
    alert('Please select an answer')
    return
  }
  my.ready = target.checked
  emit('ready_next', { ready: target.checked })
}

function choose(answer: Answer) { 
  my.answer = answer
  emit('choose_answer', { answer }) 
  // Optimistically update local snapshot so table reflects my answer immediately
  const idx = state.value?.game.currentQuestionIndex
  const snap = state.value
  if (snap && idx !== undefined && role.value) {
    const row = snap.answers[idx]
    if (row) {
      if (role.value === 'p1') row.player1.answer = answer
      else if (role.value === 'p2') row.player2.answer = answer
    }
  }
}
function start() { emit('start_game', {}) }


function emit(event: string, extra: any) {
  const { socket } = useSocket()
  if (!socket.value) return
  const questionIndex = state.value.game.currentQuestionIndex
  socket.value.emit(event, { gameId, questionIndex, ...extra })
}

function getAnswerEmoji(answer: string) {
  switch (answer) {
    case 'red': return '🔴'
    case 'yellow': return '🟡'  
    case 'green': return '🟢'
    default: return ''
  }
}

import { ensurePlayerId, useSocket } from '~/composables/useSocket.client'

async function refresh() {
  const config = useRuntimeConfig()
  const base = (config.public as any).apiBase || 'http://localhost:4000'
  const snap = await $fetch(`${base}/game/${gameId}`)
  state.value = snap
}
</script>

<style scoped>
.container {
  max-width: 720px;
  margin: 2rem auto;
  display: grid;
  gap: 1.5rem; /* Consistent gap */
  padding: 2rem;
  background-color: #f9f9f9;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #333;
}

header {
  text-align: center;
  font-size: 1.1em;
  color: #555;
}

header strong {
  font-size: 1.4em;
  color: #2c3e50;
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
  border: 1px solid #e0e0e0; /* Lighter border */
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
  gap: 1rem; /* Increased gap for buttons */
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
  flex-grow: 1; /* Allow buttons to grow */
  max-width: 180px; /* Max width for buttons */
  margin-bottom: 1.5rem;
}

.choices button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.choices button.red { background: #e74c3c; } /* Flat UI colors */
.choices button.red:hover { background: #c0392b; }
.choices button.red.red { box-shadow: 0 0 0 3px #e74c3c; } /* Highlight selected */

.choices button.yellow { background: #f1c40f; }
.choices button.yellow:hover { background: #f39c12; }
.choices button.yellow.yellow { box-shadow: 0 0 0 3px #f1c40f; }

.choices button.green { background: #2ecc71; }
.choices button.green:hover { background: #27ae60; }
.choices button.green.green { box-shadow: 0 0 0 3px #2ecc71; }

textarea {
  width: 100%;
  padding: 0.8rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 1em;
  min-height: 80px; /* Smaller height for comment */
  resize: vertical;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: border-color 0.3s ease;
}

textarea:focus {
  border-color: #007bff;
  outline: none;
}

label.row {
  margin-top: 1rem;
  font-size: 1em;
  color: #555;
}

input[type="checkbox"] {
  width: 1.2em;
  height: 1.2em;
  accent-color: #007bff;
}

.hint {
  color: #777;
  font-size: 0.9em;
  text-align: center;
  margin-top: 1rem;
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

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

th, td {
  border: 1px solid #e0e0e0;
  padding: 0.8rem;
  text-align: left;
  vertical-align: top;
}

th {
  background-color: #f0f0f0;
  font-weight: bold;
  color: #444;
}

tbody tr:nth-child(even) {
  background-color: #fcfcfc;
}

footer {
  margin-top: 2rem;
  text-align: center;
}

footer button {
  padding: 0.8rem 2rem;
  border: none;
  border-radius: 8px;
  background-color: #007bff;
  color: white;
  font-size: 1.2em;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.1s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

footer button:hover {
  background-color: #0056b3;
  transform: translateY(-2px);
}

footer span {
  font-size: 1.1em;
  color: #555;
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
  background-color: #2ecc71; /* Green */
}

.status-indicator.offline {
  background-color: #e74c3c; /* Red */
}
</style>
