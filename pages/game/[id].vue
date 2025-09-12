<template>
  <main class="container" v-if="state">
    <header class="row between">
      <strong>Question {{ state.game.currentQuestionIndex + 1 }} of {{ state.game.total }}</strong>
      <span>
        <b>P1:</b> {{ online.p1 ? 'Online' : 'Offline' }} ·
        <b>P2:</b> {{ online.p2 ? 'Online' : 'Offline' }}
      </span>
    </header>
    <div class="row between">
      <span v-if="state.game.status==='waiting' && !isAdmin">Waiting for game to start...</span>
    </div>

    <section class="card" v-if="state.game.status === 'in_progress'">
      <h2>{{ current.questionText }}</h2>

      <div class="choices">
        <button :class="{red: my.answer==='red'}" @click="choose('red')">🔴 No</button>
        <button :class="{yellow: my.answer==='yellow'}" @click="choose('yellow')">🟡 Maybe</button>
        <button :class="{green: my.answer==='green'}" @click="choose('green')">🟢 Yes</button>
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
.container { max-width: 720px; margin: 2rem auto; display: grid; gap: 1rem; }
.row { display: flex; align-items: center; gap: .5rem; }
.between { justify-content: space-between; }
.card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; }
.choices { display: flex; gap: .5rem; }
.choices button { padding: .5rem 1rem; }
.choices button.red { background: #ffd6d6 }
.choices button.yellow { background: #fff4c2 }
.choices button.green { background: #d8ffd6 }
.hint { color: #666 }
.results { margin-top: 2rem; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
th { background-color: #f5f5f5; font-weight: bold; }
</style>
