import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase, saveSnapshot, getRecentSystemHistory, getRecentAlerts, getAllRows } from '../database/db.js';
import { engineService } from '../services/engineService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDbPath = path.resolve(__dirname, '../../data/test_processguard.sqlite');

test.before(async () => {
  // Clean up any old test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  await initDatabase(testDbPath);
});

test.after(() => {
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (e) {
      // ignore
    }
  }
});

test('SQLite Database initialization creates all required tables and indexes', async () => {
  const tables = await getAllRows("SELECT name FROM sqlite_master WHERE type='table'");
  const names = tables.map((t) => t.name);

  assert.ok(names.includes('system_snapshots'), 'system_snapshots table must exist');
  assert.ok(names.includes('process_snapshots'), 'process_snapshots table must exist');
  assert.ok(names.includes('alerts'), 'alerts table must exist');

  const indexes = await getAllRows("SELECT name FROM sqlite_master WHERE type='index'");
  const idxNames = indexes.map((i) => i.name);
  assert.ok(idxNames.includes('idx_system_snapshots_created_at'), 'idx_system_snapshots_created_at index must exist');
  assert.ok(idxNames.includes('idx_alerts_severity'), 'idx_alerts_severity index must exist');
});

test('Database snapshot persistence and retrieval works correctly', async () => {
  const mockSnapshot = {
    system: {
      cpuUsage: 45.2,
      memoryUsage: 62.1,
      totalMemoryMb: 16000,
      usedMemoryMb: 9936,
      availableMemoryMb: 6064,
      uptime: 54321,
      processCount: 150,
      timestamp: '2026-09-13T12:30:00Z',
    },
    processes: [
      { pid: 9999, ppid: 1, name: 'stress_app', cpu: 88.5, memory: 12.0, rssKb: 120000, state: 'running', risk: 'WARNING' },
      { pid: 1000, ppid: 1, name: 'regular_app', cpu: 1.2, memory: 0.8, rssKb: 8000, state: 'sleeping', risk: 'NORMAL' },
    ],
    alerts: [
      {
        id: 1,
        pid: 9999,
        name: 'stress_app',
        eventType: 'HIGH_CPU',
        severity: 'WARNING',
        cpu: 88.5,
        memory: 12.0,
        message: 'CPU usage is elevated at 88.5%',
        timestamp: '2026-09-13T12:30:00Z',
      },
    ],
  };

  const id = await saveSnapshot(mockSnapshot);
  assert.ok(id > 0, 'Returned snapshot ID should be greater than 0');

  const history = await getRecentSystemHistory(10);
  assert.ok(history.length >= 1, 'History should contain at least 1 record');
  assert.equal(history[0].cpu_usage, 45.2);
  assert.equal(history[0].memory_usage, 62.1);
  assert.equal(history[0].uptime, 54321);

  const alerts = await getRecentAlerts(10);
  assert.ok(alerts.length >= 1, 'Alerts should contain at least 1 record');
  assert.equal(alerts[0].pid, 9999);
  assert.equal(alerts[0].severity, 'WARNING');
});

test('C++ Engine execution returns valid JSON schema', async () => {
  const result = await engineService.runEngine(150, 10);
  assert.ok(result, 'Result must not be null');
  assert.ok(result.system, 'Must contain system object');
  assert.ok(typeof result.system.cpuUsage === 'number', 'cpuUsage must be a number');
  assert.ok(typeof result.system.memoryUsage === 'number', 'memoryUsage must be a number');
  assert.ok(Array.isArray(result.processes), 'processes must be an array');
  assert.ok(result.processes.length > 0, 'processes array must have entries');
  assert.ok(Array.isArray(result.alerts), 'alerts must be an array');

  const firstProc = result.processes[0];
  assert.ok(typeof firstProc.pid === 'number', 'pid must be number');
  assert.ok(typeof firstProc.name === 'string', 'name must be string');
});
