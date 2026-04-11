CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_path TEXT,
  updated_at TEXT,
  extra_json TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5 (
  id UNINDEXED,
  topic,
  title,
  content,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE INDEX IF NOT EXISTS idx_docs_topic ON docs(topic);
