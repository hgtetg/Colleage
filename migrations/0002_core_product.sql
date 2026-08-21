CREATE TABLE IF NOT EXISTS lecture_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lecture_id TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, lecture_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON lecture_progress(user_id, completed);

CREATE TABLE IF NOT EXISTS room_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_room_messages_room ON room_messages(room_id, created_at);
