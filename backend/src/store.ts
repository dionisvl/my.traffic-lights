import * as core from '../../src/game'
import type { Player, AnswerColor } from '../../src/game'
import { repo } from './repo'

const onlineMap = new Map<string, { p1: boolean; p2: boolean }>()

export async function createGame(questions: string[]) {
  const state = await repo.create(questions)
  return state.id as string
}

export async function getSnapshot(gameId: string) {
  const state = await repo.get(gameId)
  if (!state) throw createHttpError(404, 'Game not found')
  const online = onlineMap.get(gameId)
  if (online) {
    state.players.p1.online = online.p1
    state.players.p2.online = online.p2
  }
  return core.toSnapshot(state)
}

export async function joinGame(gameId: string, playerId: string) {
  const s = await mustGet(gameId)
  const r = core.joinGame(s, playerId)
  if (!r.ok) throw createHttpError(400, r.error.message)
  await repo.put(r.value.state)
  const online = onlineMap.get(gameId) || { p1: false, p2: false }
  online[r.value.role] = true
  onlineMap.set(gameId, online)
  return r.value.role as Player
}

export async function setOnline(gameId: string, role: Player, online: boolean) {
  const curr = onlineMap.get(gameId) || { p1: false, p2: false }
  curr[role] = online
  onlineMap.set(gameId, curr)
}

export async function startGame(gameId: string, by: Player) {
  const s = await mustGet(gameId)
  const r = core.startGame(s, by)
  if (!r.ok) throw createHttpError(400, r.error.message)
  await repo.put(r.value)
}

export async function chooseAnswer(gameId: string, by: Player, questionIndex: number, answer: AnswerColor) {
  const s = await mustGet(gameId)
  const r = core.chooseAnswer(s, by, questionIndex, answer)
  if (!r.ok) throw createHttpError(400, r.error.message)
  await repo.put(r.value)
}

export async function submitComment(gameId: string, by: Player, questionIndex: number, comment: string) {
  const s = await mustGet(gameId)
  const r = core.submitComment(s, by, questionIndex, comment)
  if (!r.ok) throw createHttpError(400, r.error.message)
  await repo.put(r.value)
}

export async function setReady(gameId: string, by: Player, questionIndex: number, ready: boolean) {
  const s = await mustGet(gameId)
  const r = core.setReady(s, by, questionIndex, ready)
  if (!r.ok) throw createHttpError(400, r.error.message)
  await repo.put(r.value)
  return r.value
}

async function mustGet(id: string) {
  const s = await repo.get(id)
  if (!s) throw createHttpError(404, 'Game not found')
  return s
}

function createHttpError(status: number, message: string) {
  const e = new Error(message) as Error & { statusCode?: number }
  e.statusCode = status
  return e
}

