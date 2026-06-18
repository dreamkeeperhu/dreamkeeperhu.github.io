CREATE TABLE IF NOT EXISTS content_items (
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

CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(type);
CREATE INDEX IF NOT EXISTS idx_content_items_thread ON content_items(thread);
CREATE INDEX IF NOT EXISTS idx_content_items_item_date ON content_items(item_date);
CREATE INDEX IF NOT EXISTS idx_content_items_url ON content_items(url);

CREATE TABLE IF NOT EXISTS content_issues (
  id TEXT PRIMARY KEY,
  issue_key TEXT NOT NULL UNIQUE,
  content_id TEXT DEFAULT '',
  content_url TEXT DEFAULT '',
  content_type TEXT DEFAULT '',
  title TEXT DEFAULT '',
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  message TEXT NOT NULL,
  detail_json TEXT DEFAULT '{}',
  source TEXT DEFAULT 'content-ops',
  note TEXT DEFAULT '',
  snooze_until TEXT DEFAULT '',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  resolved_at TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_issues_status ON content_issues(status);
CREATE INDEX IF NOT EXISTS idx_content_issues_category ON content_issues(category);
CREATE INDEX IF NOT EXISTS idx_content_issues_severity ON content_issues(severity);
CREATE INDEX IF NOT EXISTS idx_content_issues_content_url ON content_issues(content_url);

CREATE TABLE IF NOT EXISTS link_checks (
  id TEXT PRIMARY KEY,
  content_id TEXT DEFAULT '',
  content_url TEXT NOT NULL,
  href TEXT NOT NULL,
  link_type TEXT NOT NULL,
  ok INTEGER NOT NULL DEFAULT 0,
  status_code INTEGER DEFAULT 0,
  error TEXT DEFAULT '',
  checked_at TEXT NOT NULL,
  duration_ms INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_link_checks_unique_target ON link_checks(content_url, href);
CREATE INDEX IF NOT EXISTS idx_link_checks_ok ON link_checks(ok);
CREATE INDEX IF NOT EXISTS idx_link_checks_checked_at ON link_checks(checked_at);

CREATE TABLE IF NOT EXISTS newsletter_issues (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  markdown TEXT DEFAULT '',
  text TEXT DEFAULT '',
  filters_json TEXT DEFAULT '{}',
  items_json TEXT DEFAULT '[]',
  item_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_newsletter_issues_created_at ON newsletter_issues(created_at);

CREATE TABLE IF NOT EXISTS content_ops_runs (
  id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT DEFAULT '',
  items_count INTEGER DEFAULT 0,
  issues_opened INTEGER DEFAULT 0,
  issues_seen INTEGER DEFAULT 0,
  links_checked INTEGER DEFAULT 0,
  detail_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_content_ops_runs_started_at ON content_ops_runs(started_at);
