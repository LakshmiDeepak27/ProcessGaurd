import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance = null;

export function initDatabase(dbFilePath = CONFIG.DB_PATH) {
  return new Promise((resolve, reject) => {
    // Ensure parent directory exists
    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new sqlite3.Database(dbFilePath, (err) => {
      if (err) {
        return reject(new Error(`Failed to connect to SQLite at ${dbFilePath}: ${err.message}`));
      }

      // Read schema.sql and execute
      const schemaPath = path.resolve(__dirname, 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      db.exec(schemaSql, (execErr) => {
        if (execErr) {
          return reject(new Error(`Failed to execute schema.sql: ${execErr.message}`));
        }
        dbInstance = db;
        resolve(db);
      });
    });
  });
}

export function getDb() {
  if (!dbInstance) {
    throw new Error('Database has not been initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function getRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

export function getAllRows(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

export async function saveSnapshot({ system, processes = [], alerts = [] }) {
  if (!system) return null;

  // Insert system snapshot
  const sysResult = await runQuery(
    `INSERT INTO system_snapshots (
      cpu_usage, memory_usage, total_memory_mb, used_memory_mb, available_memory_mb, process_count, uptime, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
    [
      system.cpuUsage || 0,
      system.memoryUsage || 0,
      system.totalMemoryMb || 0,
      system.usedMemoryMb || 0,
      system.availableMemoryMb || 0,
      system.processCount || processes.length,
      system.uptime || 0,
      system.timestamp || null,
    ]
  );

  const snapshotId = sysResult.lastID;

  // Persist top 10 notable or abnormal processes for historical reference
  const notableProcesses = processes
    .filter((p) => p.risk !== 'NORMAL' || p.cpu > 5 || p.memory > 5)
    .slice(0, 10);

  for (const p of notableProcesses) {
    await runQuery(
      `INSERT INTO process_snapshots (
        system_snapshot_id, pid, process_name, cpu_usage, memory_usage, rss_kb, state, risk_level, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
      [
        snapshotId,
        p.pid,
        p.name,
        p.cpu,
        p.memory,
        p.rssKb || 0,
        p.state,
        p.risk || 'NORMAL',
        system.timestamp || null,
      ]
    );
  }

  // Insert alerts
  for (const a of alerts) {
    // Avoid re-inserting if alert already recorded within the last 30s
    const existing = await getRow(
      `SELECT id FROM alerts WHERE pid = ? AND event_type = ? AND created_at >= datetime('now', '-30 seconds')`,
      [a.pid, a.eventType]
    );

    if (!existing) {
      await runQuery(
        `INSERT INTO alerts (
          pid, process_name, event_type, severity, cpu_usage, memory_usage, message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
        [
          a.pid,
          a.name,
          a.eventType,
          a.severity,
          a.cpu,
          a.memory,
          a.message,
          a.timestamp || null,
        ]
      );
    }
  }

  return snapshotId;
}

export async function getRecentSystemHistory(limit = 30) {
  return getAllRows(
    `SELECT id, cpu_usage, memory_usage, total_memory_mb, used_memory_mb, available_memory_mb, process_count, uptime, created_at
     FROM system_snapshots
     ORDER BY id DESC LIMIT ?`,
    [limit]
  );
}

export async function getRecentAlerts(limit = 50, severity = null) {
  if (severity) {
    return getAllRows(
      `SELECT id, pid, process_name, event_type, severity, cpu_usage, memory_usage, message, created_at
       FROM alerts
       WHERE UPPER(severity) = UPPER(?)
       ORDER BY id DESC LIMIT ?`,
      [severity, limit]
    );
  }
  return getAllRows(
    `SELECT id, pid, process_name, event_type, severity, cpu_usage, memory_usage, message, created_at
     FROM alerts
     ORDER BY id DESC LIMIT ?`,
    [limit]
  );
}

export async function getLatestSnapshot() {
  const system = await getRow(
    `SELECT id, cpu_usage, memory_usage, total_memory_mb, used_memory_mb, available_memory_mb, process_count, uptime, created_at
     FROM system_snapshots
     ORDER BY id DESC LIMIT 1`
  );
  return system;
}
