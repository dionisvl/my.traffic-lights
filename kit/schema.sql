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
