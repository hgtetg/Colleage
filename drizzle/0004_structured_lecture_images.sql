ALTER TABLE lecture_drafts ADD COLUMN image_manifest TEXT NOT NULL DEFAULT '[]';
ALTER TABLE lecture_drafts ADD COLUMN lesson_json TEXT NOT NULL DEFAULT '';
ALTER TABLE lecture_drafts ADD COLUMN image_selections TEXT NOT NULL DEFAULT '{}';

CREATE TABLE lecture_assets (
  id TEXT PRIMARY KEY,
  lecture_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  source_location TEXT NOT NULL,
  title TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(lecture_id) REFERENCES lectures(id) ON DELETE CASCADE,
  UNIQUE(lecture_id,source_location)
);

CREATE INDEX idx_lecture_assets_lecture
ON lecture_assets(lecture_id,source_location);

PRAGMA optimize;
