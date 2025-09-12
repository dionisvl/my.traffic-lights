const { spawn } = require('node:child_process')
const assert = require('node:assert/strict')
const { io } = require('socket.io-client')
const { randomUUID } = require('node:crypto')

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitServer(url, timeoutMs = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' })
      if (res.ok || res.status === 404) return
    } catch {}
    await delay(200)
  }
  throw new Error('Server not responding')
}

async function main() {
  // New e2e targets the external NestJS backend only.
  const attach = process.argv.includes('--attach')
  const PORT = Number(process.env.PORT || (attach ? 4000 : 4010))
  let server = null
  if (!attach) {
    // Start Nest backend in dev mode from ./backend (ts-node-dev)
    server = spawn('npm', ['run', 'start:dev', '--prefix', 'backend'], {
      env: { ...process.env, PORT: String(PORT) },
      stdio: 'inherit',
    })
  }
  try {
    await waitServer(`http://localhost:${PORT}`)

    // Create game (Nest route)
    const createRes = await fetch(`http://localhost:${PORT}/game`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questions: ['Q1', 'Q2'] }),
    })
    assert.equal(createRes.ok, true, 'create game failed')
    const { gameId } = await createRes.json()
    assert.ok(gameId)

    await delay(200) // Wait for DB

    // Connect two Socket.IO clients to backend
    const url = `http://localhost:${PORT}`
    const a = io(url, { transports: ['websocket'] })
    const b = io(url, { transports: ['websocket'] })

    const roleA = await Promise.race([
      new Promise((resolve, reject) => {
        a.on('connect', () => a.emit('join_game', { gameId, playerId: randomUUID() }))
        a.on('joined', (p) => resolve(p.role))
        a.on('error', reject)
        a.on('connect_error', reject)
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Player A join timeout')), 5000))
    ])

    const roleB = await Promise.race([
      new Promise((resolve, reject) => {
        b.on('connect', () => b.emit('join_game', { gameId, playerId: randomUUID() }))
        b.on('joined', (p) => resolve(p.role))
        b.on('error', reject)
        b.on('connect_error', reject)
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Player B join timeout')), 5000))
    ])

    assert.notEqual(roleA, roleB, 'roles must differ')
    const p1 = roleA === 'p1' ? a : b
    const p2 = roleA === 'p1' ? b : a

    // Start game by p1
    const started = waitFor(p1, 'game_started')
    p1.emit('start_game', { gameId })
    await started

    // Q0 answers
    p1.emit('choose_answer', { gameId, questionIndex: 0, answer: 'green' })
    p2.emit('choose_answer', { gameId, questionIndex: 0, answer: 'red' })
    p1.emit('ready_next', { gameId, questionIndex: 0, ready: true })
    const movedToQ1 = Promise.all([waitFor(p1, 'next_question'), waitFor(p2, 'next_question')])
    p2.emit('ready_next', { gameId, questionIndex: 0, ready: true })
    await movedToQ1

    // Q1 answers and complete
    p1.emit('choose_answer', { gameId, questionIndex: 1, answer: 'yellow' })
    p2.emit('choose_answer', { gameId, questionIndex: 1, answer: 'green' })
    p1.emit('ready_next', { gameId, questionIndex: 1, ready: true })
    const movedToCompletion = Promise.all([waitFor(p1, 'game_completed'), waitFor(p2, 'game_completed')])
    p2.emit('ready_next', { gameId, questionIndex: 1, ready: true })
    await movedToCompletion

    a.disconnect(); b.disconnect()
    console.log('E2E OK')
  } finally {
    if (server) server.kill()
  }
}



function waitFor(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve))
}



main().catch((e) => { console.error('E2E FAILED', e); process.exit(1) })
