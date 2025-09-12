import * as core from '../../../src/game'
import type { Repo } from './index'
import type { GameState } from '../../../src/game'

export function createMemoryRepo(): Repo {
  const map = new Map<string, GameState>()
  return {
    async get(id) { return map.get(id) ?? null },
    async put(state) { map.set(state.id, state) },
    async create(questions) {
      const { randomUUID } = await import('node:crypto')
      const id = randomUUID()
      const r = core.createGame(id, questions)
      if (!r.ok) throw new Error(r.error.message)
      map.set(id, r.value)
      return r.value
    },
  }
}

