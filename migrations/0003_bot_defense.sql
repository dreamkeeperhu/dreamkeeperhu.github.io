CREATE TABLE IF NOT EXISTS bot_audit_events (
  id TEXT PRIMARY KEY,
  event_at TEXT NOT NULL,
  action TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  reasons_json TEXT DEFAULT '[]',
  route_group TEXT DEFAULT '',
  path_group TEXT DEFAULT '',
  method TEXT DEFAULT '',
  ip_hash TEXT DEFAULT '',
  ua_hash TEXT DEFAULT '',
  fingerprint TEXT DEFAULT '',
  user_agent_sample TEXT DEFAULT '',
  country TEXT DEFAULT '',
  colo TEXT DEFAULT '',
  cf_client_bot INTEGER NOT NULL DEFAULT 0,
  cf_verified_bot_category TEXT DEFAULT '',
  bot_score INTEGER NOT NULL DEFAULT 0,
  detail_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_bot_audit_events_event_at ON bot_audit_events(event_at);
CREATE INDEX IF NOT EXISTS idx_bot_audit_events_action ON bot_audit_events(action);
CREATE INDEX IF NOT EXISTS idx_bot_audit_events_reason ON bot_audit_events(reason);
CREATE INDEX IF NOT EXISTS idx_bot_audit_events_fingerprint ON bot_audit_events(fingerprint);
CREATE INDEX IF NOT EXISTS idx_bot_audit_events_path_group ON bot_audit_events(path_group);

CREATE TABLE IF NOT EXISTS bot_audit_rollups (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,
  granularity TEXT NOT NULL,
  action TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  reason TEXT NOT NULL,
  route_group TEXT DEFAULT '',
  path_group TEXT DEFAULT '',
  event_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_audit_rollups_bucket ON bot_audit_rollups(bucket);
CREATE INDEX IF NOT EXISTS idx_bot_audit_rollups_granularity ON bot_audit_rollups(granularity);
CREATE INDEX IF NOT EXISTS idx_bot_audit_rollups_reason ON bot_audit_rollups(reason);

CREATE TABLE IF NOT EXISTS bot_policy_overrides (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT DEFAULT '',
  expires_at TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_policy_overrides_kind ON bot_policy_overrides(kind);
CREATE INDEX IF NOT EXISTS idx_bot_policy_overrides_action ON bot_policy_overrides(action);
CREATE INDEX IF NOT EXISTS idx_bot_policy_overrides_expires_at ON bot_policy_overrides(expires_at);
