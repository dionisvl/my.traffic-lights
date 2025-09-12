# Traffic Lights — two‑player online game

Stack: Nuxt 3 (frontend) + NestJS (backend) + Socket.IO. Two players choose answers (🔴/🟡/🟢), add comments, and move forward only when both are ready. State is kept in memory or in Postgres.

## Quick start (local)
- Install deps: `npm i`
- Start backend (NestJS, port 4000): `npm run dev:back`
- In another terminal start frontend (Nuxt, port 3000): `npm run dev:front`
- Open `http://localhost:3000`

Frontend runtime config:
- `NUXT_PUBLIC_API_BASE` — API base URL (default `http://localhost:4000`)
- `NUXT_PUBLIC_WS_URL` — Socket.IO URL (default `http://localhost:4000`)

Backend uses `DATABASE_URL` to connect to Postgres. If not set, in‑memory repository is used.

## Docker Compose (frontend + backend + postgres)
- Run: `docker compose up --build`
- Frontend: `http://localhost:3000`
- Backend (Nest): `http://localhost:4000`

In `compose.yml` frontend gets `NUXT_PUBLIC_API_BASE=http://backend:4000` and `NUXT_PUBLIC_WS_URL=http://backend:4000`.

## Database
- Env: `DATABASE_URL=postgresql://user:password@localhost:5432/game_db`
- Schema is created automatically on first access (see `backend/src/repo/pg_normalized.ts`). No separate migrations for MVP.

## Scripts
- `npm test` — unit tests for game engine (node:test)
- `npm run dev:front` — Nuxt dev (port 3000)
- `npm run dev:back` — Nest dev (port 4000)
- `npm run dev:all` — front and back together
- `npm run nuxt:build` — build frontend
- `npm run e2e:attach` / `npm run e2e` — e2e against backend (see below)

## E2E
E2E script now targets the Nest backend. It starts `npm run start:dev --prefix backend` (unless `--attach`) and hits:
- `POST /game` to create a game
- connects two Socket.IO clients, runs the flow, and polls `GET /game/:id`

## Playwright Tests
To run the browser-based end-to-end tests, use the following command:
```bash
npx playwright test
```
This will launch a real browser and simulate the full user flow.

## HTTP API (Nest, port 4000)
- `POST /game` — body: `{ questions: string[] }` → `{ gameId }`
- `GET /game/:id` — snapshot:
  `{ game: { id, status, currentQuestionIndex, total }, players: { p1: { online }, p2: { online } }, answers: [{ questionIndex, questionText, player1: { answer, comment }, player2: { answer, comment } }] }`

## Socket.IO events
- Client → Server: `join_game { gameId, playerId }`, `start_game { gameId }`, `choose_answer { gameId, questionIndex, answer }`, `submit_comment { gameId, questionIndex, comment }`, `ready_next { gameId, questionIndex, ready }`
- Server → Client: `joined { role }`, `player_status { player, online }`, `game_started {}`,
  `question_show { questionIndex }`, `answer_updated { questionIndex }`, `comment_received { questionIndex, player }`, `next_question { questionIndex }`, `game_completed {}`

## Architecture
- Core: `src/game.ts` — pure functions, immutable, covered by tests
- Backend (NestJS): `backend/src/*` — `game.controller.ts`, `game.gateway.ts`, `repo/*`
- Frontend (Nuxt): pages in `pages/*`, socket composable in `composables/useSocket.client.ts`
- Repository: `backend/src/repo/*` — In‑Memory or Postgres (normalized); selected via `DATABASE_URL`
- Online statuses: in backend process memory (MVP)
- `docs/game-flow-sequence.puml` - Diagram of the game's complete flow and architecture.

## UI
- `/` — create a game, returns link `/game/{UUID}`
- `/game/{UUID}` — gameplay screen
- `/game/{UUID}/results` — results table

## Notes
- Minimal deps, clear interfaces, tests for critical logic
- Ready to extend: auth, persistent online tracking, repository adapters for different DBs
