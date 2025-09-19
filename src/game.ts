export type AnswerColor = 'red' | 'yellow' | 'green';
export type Player = 'p1' | 'p2';
export type GameStatus = 'waiting' | 'in_progress' | 'completed';

export interface PlayerState {
  id?: string | null;
  online: boolean;
}

export interface PlayerQA {
  answer?: AnswerColor;
  comment?: string;
  ready: boolean;
  answeredAt?: string; // ISO timestamp
}

export interface QuestionState {
  questionIndex: number;
  questionText: string;
  p1: PlayerQA;
  p2: PlayerQA;
  revealedAt?: string; // ISO timestamp of first answer
}

export interface GameState {
  id: string;
  status: GameStatus;
  questions: string[];
  currentQuestionIndex: number;
  players: { p1: PlayerState; p2: PlayerState };
  answers: QuestionState[]; // one per question index
  admin: Player; // admin is always p1 for MVP
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = (code: string, message: string): Result<never> => ({ ok: false, error: { code, message } });

const nowIso = () => new Date().toISOString();

const mkEmptyQA = (): PlayerQA => ({ ready: false });

const initAnswers = (questions: string[]): QuestionState[] =>
  questions.map((q, i) => ({ questionIndex: i, questionText: q, p1: mkEmptyQA(), p2: mkEmptyQA() }));

export function createGame(id: string, questions: string[]): Result<GameState> {
  if (!Array.isArray(questions) || questions.length < 1) {
    return err('bad_request', 'At least 1 question');
  }
  const state: GameState = {
    id,
    status: 'waiting',
    questions: [...questions],
    currentQuestionIndex: 0,
    players: { p1: { id: undefined, online: false }, p2: { id: undefined, online: false } },
    answers: initAnswers(questions),
    admin: 'p1',
  };
  return ok(state);
}

export function joinGame(state: GameState, playerId: string): Result<{ state: GameState; role: Player }> {
  const s = { ...state, players: { p1: { ...state.players.p1 }, p2: { ...state.players.p2 } } };

  if (s.players.p1.id === playerId) {
    s.players.p1.online = true;
    return ok({ state: s, role: 'p1' });
  }
  if (s.players.p2.id === playerId) {
    s.players.p2.online = true;
    return ok({ state: s, role: 'p2' });
  }

  if (!s.players.p1.id) {
    s.players.p1.id = playerId;
    s.players.p1.online = true;
    return ok({ state: s, role: 'p1' });
  }
  if (!s.players.p2.id) {
    s.players.p2.id = playerId;
    s.players.p2.online = true;
    return ok({ state: s, role: 'p2' });
  }
  return err('room_full', 'Both slots are taken');
}

export function setOnline(state: GameState, role: Player, online: boolean): GameState {
  return { ...state, players: { ...state.players, [role]: { ...state.players[role], online } } };
}

export function startGame(state: GameState, by: Player): Result<GameState> {
  if (state.status !== 'waiting') return err('bad_state', 'Game already started or completed');
  if (by !== state.admin) return err('forbidden', 'Only admin can start the game');
  if (!state.players.p1.id || !state.players.p2.id) return err('not_ready', 'Both players must be connected');
  return ok({ ...state, status: 'in_progress', currentQuestionIndex: 0 });
}

function requireInProgress(state: GameState): Result<GameState> {
  if (state.status !== 'in_progress') return err('bad_state', 'Game not in progress');
  return ok(state);
}

function requireCurrentIndex(state: GameState, questionIndex: number): Result<GameState> {
  if (questionIndex !== state.currentQuestionIndex) return err('bad_index', 'Invalid question index');
  if (questionIndex < 0 || questionIndex >= state.questions.length) return err('bad_index', 'Out of bounds');
  return ok(state);
}

export function chooseAnswer(
  state: GameState,
  by: Player,
  questionIndex: number,
  answer: AnswerColor,
): Result<GameState> {
  const p1 = requireInProgress(state);
  if (!p1.ok) return p1;
  const p2 = requireCurrentIndex(state, questionIndex);
  if (!p2.ok) return p2;

  const qPrev = state.answers[questionIndex];
  const q: QuestionState = {
    ...qPrev,
    [by]: { ...qPrev[by], answer, answeredAt: nowIso(), ready: false },
    revealedAt: qPrev.revealedAt ?? nowIso(),
  } as QuestionState;

  const answers = state.answers.slice();
  answers[questionIndex] = q;
  return ok({ ...state, answers });
}

export function submitComment(
  state: GameState,
  by: Player,
  questionIndex: number,
  comment: string,
): Result<GameState> {
  const p1 = requireInProgress(state);
  if (!p1.ok) return p1;
  const p2 = requireCurrentIndex(state, questionIndex);
  if (!p2.ok) return p2;

  const qPrev = state.answers[questionIndex];
  const q: QuestionState = { ...qPrev, [by]: { ...qPrev[by], comment, ready: false } } as QuestionState;
  const answers = state.answers.slice();
  answers[questionIndex] = q;
  return ok({ ...state, answers });
}

export function setReady(
  state: GameState,
  by: Player,
  questionIndex: number,
  ready: boolean,
): Result<GameState> {
  const p1 = requireInProgress(state);
  if (!p1.ok) return p1;
  const p2 = requireCurrentIndex(state, questionIndex);
  if (!p2.ok) return p2;

  const qPrev = state.answers[questionIndex];
  // Do not allow marking ready if no answer selected
  if (ready && !qPrev[by].answer) {
    return err('bad_state', 'Cannot be ready without an answer');
  }
  const q: QuestionState = { ...qPrev, [by]: { ...qPrev[by], ready } } as QuestionState;
  let next: GameState = { ...state, answers: state.answers.map((x, i) => (i === questionIndex ? q : x)) };

  // Advance only when both players are ready AND both provided answers
  const bothReady = q.p1.ready && q.p2.ready && !!q.p1.answer && !!q.p2.answer;
  const isLast = questionIndex >= state.questions.length - 1;
  if (bothReady) {
    if (isLast) {
      next = { ...next, status: 'completed' };
    } else {
      next = { ...next, currentQuestionIndex: state.currentQuestionIndex + 1 };
    }
  }
  return ok(next);
}

export function toSnapshot(state: GameState) {
  return {
    game: {
      id: state.id,
      status: state.status,
      currentQuestionIndex: state.currentQuestionIndex,
      total: state.questions.length,
    },
    players: {
      p1: { online: state.players.p1.online },
      p2: { online: state.players.p2.online },
    },
    answers: state.answers.map((a) => ({
      questionIndex: a.questionIndex,
      questionText: a.questionText,
      player1: { answer: a.p1.answer, comment: a.p1.comment, ready: a.p1.ready },
      player2: { answer: a.p2.answer, comment: a.p2.comment, ready: a.p2.ready },
    })),
  } as const;
}
