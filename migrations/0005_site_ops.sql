CREATE TABLE IF NOT EXISTS site_ops_events (
  id TEXT PRIMARY KEY,
  event_at TEXT NOT NULL,
  event_type TEXT NOT NULL,
  action TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 0,
  method TEXT DEFAULT '',
  path TEXT DEFAULT '',
  ip_hash TEXT DEFAULT '',
  ua_hash TEXT DEFAULT '',
  fingerprint TEXT DEFAULT '',
  user_agent_sample TEXT DEFAULT '',
  country TEXT DEFAULT '',
  colo TEXT DEFAULT '',
  detail_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_site_ops_events_event_at ON site_ops_events(event_at);
CREATE INDEX IF NOT EXISTS idx_site_ops_events_event_type ON site_ops_events(event_type);
CREATE INDEX IF NOT EXISTS idx_site_ops_events_action ON site_ops_events(action);
CREATE INDEX IF NOT EXISTS idx_site_ops_events_path ON site_ops_events(path);
CREATE INDEX IF NOT EXISTS idx_site_ops_events_fingerprint ON site_ops_events(fingerprint);

CREATE TABLE IF NOT EXISTS site_ops_maintenance_runs (
  id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT DEFAULT '',
  detail_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_site_ops_maintenance_runs_started_at ON site_ops_maintenance_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_site_ops_maintenance_runs_run_type ON site_ops_maintenance_runs(run_type);
CREATE INDEX IF NOT EXISTS idx_site_ops_maintenance_runs_status ON site_ops_maintenance_runs(status);

CREATE TABLE IF NOT EXISTS site_ops_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_at TEXT NOT NULL,
  snapshot_type TEXT NOT NULL,
  status TEXT NOT NULL,
  summary_json TEXT DEFAULT '{}',
  detail_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_site_ops_snapshots_snapshot_at ON site_ops_snapshots(snapshot_at);
CREATE INDEX IF NOT EXISTS idx_site_ops_snapshots_snapshot_type ON site_ops_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_site_ops_snapshots_status ON site_ops_snapshots(status);
