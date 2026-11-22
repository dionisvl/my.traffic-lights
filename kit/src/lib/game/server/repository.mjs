export function repository(pool) {
  return {
    async get(id) {
      const g = await pool.query('SELECT * FROM games WHERE id=$1', [id])
      if (!g.rows[0]) return null
      const gr = g.rows[0]
      const qa = await pool.query('SELECT * FROM game_answers WHERE game_id=$1 ORDER BY question_index ASC', [id])
      const answers = []
      const total = gr.questions.length
      for (let i = 0; i < total; i++) {
        const row = qa.rows.find((r) => r.question_index === i)
        answers.push({
          questionIndex: i,
          questionText: gr.questions[i],
          p1: { answer: row?.player1_answer ?? undefined, comment: row?.player1_comment ?? undefined, ready: row?.player1_ready ?? false, answeredAt: row?.player1_answered_at ?? undefined },
          p2: { answer: row?.player2_answer ?? undefined, comment: row?.player2_comment ?? undefined, ready: row?.player2_ready ?? false, answeredAt: row?.player2_answered_at ?? undefined },
          revealedAt: row?.revealed_at ?? undefined,
        })
      }
      const state = {
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
  };
}
