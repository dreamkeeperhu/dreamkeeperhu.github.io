CREATE TABLE IF NOT EXISTS content_items_new (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  thread TEXT DEFAULT '',
  status TEXT DEFAULT '',
  status_detail TEXT DEFAULT '',
  item_date TEXT DEFAULT '',
  tags_json TEXT DEFAULT '[]',
  relations_json TEXT DEFAULT '{}',
  artifacts_json TEXT DEFAULT '[]',
  links_json TEXT DEFAULT '[]',
  flags_json TEXT DEFAULT '{}',
  body_hash TEXT DEFAULT '',
  body_word_count INTEGER DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR REPLACE INTO content_items_new (
  id, type, title, url, thread, status, status_detail, item_date,
  tags_json, relations_json, artifacts_json, links_json, flags_json,
  body_hash, body_word_count, first_seen_at, updated_at
)
SELECT
  id, type, title, url, thread, status, status_detail, item_date,
  tags_json, relations_json, artifacts_json, links_json, flags_json,
  body_hash, body_word_count, first_seen_at, updated_at
FROM content_items;

DROP TABLE content_items;
ALTER TABLE content_items_new RENAME TO content_items;

CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(type);
CREATE INDEX IF NOT EXISTS idx_content_items_thread ON content_items(thread);
CREATE INDEX IF NOT EXISTS idx_content_items_item_date ON content_items(item_date);
CREATE INDEX IF NOT EXISTS idx_content_items_url ON content_items(url);
