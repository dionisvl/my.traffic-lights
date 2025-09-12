const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createGame,
  joinGame,
  startGame,
  chooseAnswer,
  submitComment,
  setReady,
  toSnapshot,
} = require('../dist/game.js');

function unwrap(res) {
  assert.equal(res.ok, true, `Expected ok, got error: ${JSON.stringify(res.error)}`);
  return res.value;
}

describe('Game engine - create/join/start', () => {
  it('creates game with >=1 questions', () => {
    const r1 = createGame('g1', ['Q1']);
    assert.equal(r1.ok, true);
    const s1 = unwrap(r1);
    assert.equal(s1.status, 'waiting');
    assert.equal(s1.questions.length, 1);

    const r2 = createGame('g2', []);
    assert.equal(r2.ok, false);
  });

  it('first join -> p1, second -> p2, third rejected; repeated join keeps role', () => {
    let s = unwrap(createGame('g', ['Q1', 'Q2']));
    const j1 = unwrap(joinGame(s, 'A'));
    s = j1.state;
    assert.equal(j1.role, 'p1');
    assert.equal(s.players.p1.id, 'A');
    assert.equal(s.players.p1.online, true);

    const j2 = unwrap(joinGame(s, 'B'));
    s = j2.state;
    assert.equal(j2.role, 'p2');
    assert.equal(s.players.p2.id, 'B');

    const j1repeat = unwrap(joinGame(s, 'A'));
    s = j1repeat.state;
    assert.equal(j1repeat.role, 'p1');

    const j3 = joinGame(s, 'C');
    assert.equal(j3.ok, false);
  });

  it('only admin (p1) can start; needs both players; only once', () => {
    let s = unwrap(createGame('g', ['Q1', 'Q2']));
    const a = unwrap(joinGame(s, 'A')); s = a.state;
    const b = unwrap(joinGame(s, 'B')); s = b.state;

    const badByP2 = startGame(s, 'p2');
    assert.equal(badByP2.ok, false);

    s = unwrap(startGame(s, 'p1'));
    assert.equal(s.status, 'in_progress');

    const again = startGame(s, 'p1');
    assert.equal(again.ok, false);
  });
});

describe('Answer/comment/ready flow', () => {
  function mkStarted() {
    let s = unwrap(createGame('g', ['Q1', 'Q2']));
    s = unwrap(joinGame(s, 'A')).state;
    s = unwrap(joinGame(s, 'B')).state;
    s = unwrap(startGame(s, 'p1'));
    return s;
  }

  it('chooseAnswer sets first revealedAt once, resets own ready', () => {
    let s = mkStarted();
    const q0 = s.answers[0];
    assert.equal(q0.revealedAt, undefined);
    assert.equal(q0.p1.ready, false);
    assert.equal(q0.p2.ready, false);

    s = unwrap(chooseAnswer(s, 'p1', 0, 'green'));
    const after1 = s.answers[0];
    assert.ok(after1.revealedAt);
    assert.equal(after1.p1.answer, 'green');
    assert.equal(after1.p1.ready, false);

    const revealedOnce = after1.revealedAt;
    s = unwrap(chooseAnswer(s, 'p1', 0, 'yellow'));
    assert.equal(s.answers[0].revealedAt, revealedOnce);
  });

  it('submitComment resets own ready', () => {
    let s = mkStarted();
    s = unwrap(chooseAnswer(s, 'p1', 0, 'green'));
    s = unwrap(setReady(s, 'p1', 0, true));
    assert.equal(s.answers[0].p1.ready, true);

    s = unwrap(submitComment(s, 'p1', 0, 'note'));
    assert.equal(s.answers[0].p1.comment, 'note');
    assert.equal(s.answers[0].p1.ready, false);
  });

  it('both ready -> next question; last -> completed', () => {
    let s = mkStarted();
    // Q0
    s = unwrap(chooseAnswer(s, 'p1', 0, 'green'));
    s = unwrap(chooseAnswer(s, 'p2', 0, 'red'));
    s = unwrap(setReady(s, 'p1', 0, true));
    s = unwrap(setReady(s, 'p2', 0, true));
    assert.equal(s.currentQuestionIndex, 1);
    assert.equal(s.status, 'in_progress');

    // Q1 (last)
    s = unwrap(chooseAnswer(s, 'p1', 1, 'yellow'));
    s = unwrap(setReady(s, 'p1', 1, true));
    s = unwrap(chooseAnswer(s, 'p2', 1, 'green'));
    s = unwrap(setReady(s, 'p2', 1, true));
    assert.equal(s.status, 'completed');
  });

  it('guards: bad index, not in progress', () => {
    let s = unwrap(createGame('g', ['Q1']));
    // not started yet
    const r1 = chooseAnswer(s, 'p1', 0, 'green');
    assert.equal(r1.ok, false);

    // start and then bad index
    s = unwrap(joinGame(s, 'A')).state;
    s = unwrap(joinGame(s, 'B')).state;
    s = unwrap(startGame(s, 'p1'));
    const r2 = chooseAnswer(s, 'p1', 1, 'green');
    assert.equal(r2.ok, false);
  });
});

describe('Snapshot shape', () => {
  it('matches plan.md shape', () => {
    let s = unwrap(createGame('g', ['Q1', 'Q2']));
    s = unwrap(joinGame(s, 'A')).state;
    s = unwrap(joinGame(s, 'B')).state;
    s = unwrap(startGame(s, 'p1'));
    s = unwrap(chooseAnswer(s, 'p1', 0, 'green'));
    s = unwrap(submitComment(s, 'p2', 0, 'hello'));

    const snapshot = toSnapshot(s);
    assert.deepEqual(Object.keys(snapshot.game), ['id', 'status', 'currentQuestionIndex', 'total']);
    assert.deepEqual(Object.keys(snapshot.players.p1), ['online']);
    assert.equal(snapshot.answers.length, 2);
    assert.deepEqual(Object.keys(snapshot.answers[0].player1), ['answer', 'comment']);
  });
});
