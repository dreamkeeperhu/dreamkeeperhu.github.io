CREATE TABLE IF NOT EXISTS bot_risk_snapshots (
  fingerprint TEXT PRIMARY KEY,
  ip_hash TEXT DEFAULT '',
  ua_hash TEXT DEFAULT '',
  risk_score INTEGER NOT NULL DEFAULT 0,
  failure_count REAL NOT NULL DEFAULT 0,
  last_action TEXT DEFAULT '',
  last_status INTEGER DEFAULT 0,
  last_reason TEXT DEFAULT '',
  reasons_json TEXT DEFAULT '[]',
  path_groups_json TEXT DEFAULT '[]',
  user_agent_sample TEXT DEFAULT '',
  country TEXT DEFAULT '',
  colo TEXT DEFAULT '',
  deny_until TEXT DEFAULT '',
  note TEXT DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_risk_snapshots_risk_score ON bot_risk_snapshots(risk_score);
CREATE INDEX IF NOT EXISTS idx_bot_risk_snapshots_updated_at ON bot_risk_snapshots(updated_at);
CREATE INDEX IF NOT EXISTS idx_bot_risk_snapshots_last_reason ON bot_risk_snapshots(last_reason);

CREATE TABLE IF NOT EXISTS bot_canary_hits (
  id TEXT PRIMARY KEY,
  hit_at TEXT NOT NULL,
  path TEXT NOT NULL,
  fingerprint TEXT DEFAULT '',
  ip_hash TEXT DEFAULT '',
  ua_hash TEXT DEFAULT '',
  user_agent_sample TEXT DEFAULT '',
  country TEXT DEFAULT '',
  colo TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_bot_canary_hits_hit_at ON bot_canary_hits(hit_at);
CREATE INDEX IF NOT EXISTS idx_bot_canary_hits_fingerprint ON bot_canary_hits(fingerprint);

CREATE TABLE IF NOT EXISTS bot_policy_replay_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  since_at TEXT DEFAULT '',
  sample_limit INTEGER DEFAULT 0,
  thresholds_json TEXT DEFAULT '{}',
  result_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_bot_policy_replay_runs_created_at ON bot_policy_replay_runs(created_at);
