import type { GameState } from '../../../src/game'
import { createMemoryRepo } from './memory'
import { createPgNormalizedRepo } from './pg_normalized'

export interface Repo {
  get(id: string): Promise<GameState | null>
  put(state: GameState): Promise<void>
  create(questions: string[]): Promise<GameState>
}

function envRepo(): Repo {
  if (process.env.DATABASE_URL) {
    return createPgNormalizedRepo(process.env.DATABASE_URL)
  }
  return createMemoryRepo()
}

export const repo: Repo = envRepo()

