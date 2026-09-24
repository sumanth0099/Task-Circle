-- Group chat messages for circle members
CREATE TABLE IF NOT EXISTS circle_messages (
  id          BIGSERIAL PRIMARY KEY,
  circle_id   BIGINT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_messages_circle_created
  ON circle_messages(circle_id, created_at DESC);
