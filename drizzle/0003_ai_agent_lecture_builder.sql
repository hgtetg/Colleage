ALTER TABLE lectures ADD COLUMN design TEXT NOT NULL DEFAULT 'atelier';
ALTER TABLE lectures ADD COLUMN content_json TEXT NOT NULL DEFAULT '';

CREATE TABLE lecture_drafts (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  agent TEXT NOT NULL DEFAULT 'chatgpt',
  lecture_file_key TEXT,
  lecture_file_name TEXT,
  agent_file_key TEXT,
  agent_file_name TEXT,
  design TEXT NOT NULL DEFAULT 'atelier',
  image_choices TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_lecture_drafts_owner
ON lecture_drafts(created_by,subject_id,status,updated_at);

PRAGMA optimize;
