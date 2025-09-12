import type { Repo } from './index'
import type { GameState } from '../../../src/game'

export function createPgNormalizedRepo(url: string): Repo {
  let pool: any
  let ready: Promise<void> | null = null
  async function ensure() {
    if (!pool) {
      const mod: any = await import('pg')
      const Pool = mod.Pool || mod.default?.Pool
      pool = new Pool({ connectionString: url })
    }
    if (!ready) {
      ready = (async () => {
        await pool.query(`
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'answer_color') THEN
    CREATE TYPE answer_color AS ENUM ('red','yellow','green');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY,
  status VARCHAR(20) NOT NULL,
  questions TEXT[] NOT NULL,
  current_question_index INTEGER NOT NULL DEFAULT 0,
  player1_id UUID,
  player2_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_answers (
  id SERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  player1_answer answer_color,
  player1_comment TEXT,
  player2_answer answer_color,
  player2_comment TEXT,
  player1_ready BOOLEAN NOT NULL DEFAULT FALSE,
  player2_ready BOOLEAN NOT NULL DEFAULT FALSE,
  player1_answered_at TIMESTAMPTZ,
  player2_answered_at TIMESTAMPTZ,
  revealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, question_index)
);
        `)
      })()
    }
    return pool
  }

  return {
    async get(id) {
      const pool = await ensure(); await ready
      const g = await pool.query('SELECT * FROM games WHERE id=$1', [id])
      if (!g.rows[0]) return null
      const gr = g.rows[0]
      const qa = await pool.query('SELECT * FROM game_answers WHERE game_id=$1 ORDER BY question_index ASC', [id])
      const answers = [] as any[]
      const total = gr.questions.length
      for (let i = 0; i < total; i++) {
        const row = qa.rows.find((r: any) => r.question_index === i)
        answers.push({
          questionIndex: i,
          questionText: gr.questions[i],
          p1: { answer: row?.player1_answer ?? undefined, comment: row?.player1_comment ?? undefined, ready: row?.player1_ready ?? false, answeredAt: row?.player1_answered_at ?? undefined },
          p2: { answer: row?.player2_answer ?? undefined, comment: row?.player2_comment ?? undefined, ready: row?.player2_ready ?? false, answeredAt: row?.player2_answered_at ?? undefined },
          revealedAt: row?.revealed_at ?? undefined,
        })
      }
      const state: GameState = {
        id: gr.id,
        status: gr.status,
        questions: gr.questions,
        currentQuestionIndex: gr.current_question_index,
        players: { p1: { id: gr.player1_id, online: false }, p2: { id: gr.player2_id, online: false } },
        answers,
        admin: 'p1',
      }
      return state
    },
    async put(state) {
      const pool = await ensure(); await ready
      await pool.query(
        `INSERT INTO games(id, status, questions, current_question_index, player1_id, player2_id)
         VALUES($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, questions=EXCLUDED.questions, current_question_index=EXCLUDED.current_question_index, player1_id=EXCLUDED.player1_id, player2_id=EXCLUDED.player2_id, updated_at=NOW()`,
        [state.id, state.status, state.questions, state.currentQuestionIndex, state.players.p1.id ?? null, state.players.p2.id ?? null],
      )
      for (const q of state.answers) {
        await pool.query(
          `INSERT INTO game_answers(game_id, question_index, question_text, player1_answer, player1_comment, player2_answer, player2_comment, player1_ready, player2_ready, player1_answered_at, player2_answered_at, revealed_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (game_id, question_index) DO UPDATE SET question_text=EXCLUDED.question_text, player1_answer=EXCLUDED.player1_answer, player1_comment=EXCLUDED.player1_comment, player2_answer=EXCLUDED.player2_answer, player2_comment=EXCLUDED.player2_comment, player1_ready=EXCLUDED.player1_ready, player2_ready=EXCLUDED.player2_ready, player1_answered_at=EXCLUDED.player1_answered_at, player2_answered_at=EXCLUDED.player2_answered_at, revealed_at=EXCLUDED.revealed_at, updated_at=NOW()`,
          [state.id, q.questionIndex, q.questionText, q.p1.answer ?? null, q.p1.comment ?? null, q.p2.answer ?? null, q.p2.comment ?? null, q.p1.ready, q.p2.ready, q.p1.answeredAt ?? null, q.p2.answeredAt ?? null, q.revealedAt ?? null],
        )
      }
    },
    async create(questions) {
      const pool = await ensure(); await ready
      const { randomUUID } = await import('node:crypto')
      const id = randomUUID()
      await pool.query(
        `INSERT INTO games(id, status, questions, current_question_index) VALUES($1,'waiting',$2,0)`,
        [id, questions],
      )
      for (let i = 0; i < questions.length; i++) {
        await pool.query(
          `INSERT INTO game_answers(game_id, question_index, question_text) VALUES($1,$2,$3)`,
          [id, i, questions[i]],
        )
      }
      return await this.get(id) as GameState
    },
  }
}

