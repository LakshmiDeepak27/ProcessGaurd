-- ProcessGuard Database Schema (SQLite)

CREATE TABLE IF NOT EXISTS system_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cpu_usage REAL NOT NULL,
    memory_usage REAL NOT NULL,
    total_memory_mb INTEGER,
    used_memory_mb INTEGER,
    available_memory_mb INTEGER,
    process_count INTEGER NOT NULL,
    uptime INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_system_snapshots_created_at ON system_snapshots(created_at);

CREATE TABLE IF NOT EXISTS process_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    system_snapshot_id INTEGER,
    pid INTEGER NOT NULL,
    process_name TEXT NOT NULL,
    cpu_usage REAL NOT NULL,
    memory_usage REAL NOT NULL,
    rss_kb INTEGER DEFAULT 0,
    state TEXT NOT NULL,
    risk_level TEXT DEFAULT 'NORMAL',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (system_snapshot_id) REFERENCES system_snapshots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_process_snapshots_pid ON process_snapshots(pid);
CREATE INDEX IF NOT EXISTS idx_process_snapshots_created_at ON process_snapshots(created_at);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pid INTEGER NOT NULL,
    process_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    cpu_usage REAL NOT NULL,
    memory_usage REAL NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_pid ON alerts(pid);
