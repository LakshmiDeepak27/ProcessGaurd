import fs from 'fs';
import os from 'os';
import { engineService } from '../services/engineService.js';
import { getRecentSystemHistory, getRecentAlerts, getLatestSnapshot } from '../database/db.js';

export async function getHealth(req, res) {
  const binary = engineService.getBinaryPath();
  const binaryExists = fs.existsSync(binary);

  res.json({
    status: 'UP',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    engine: {
      binaryPath: binary,
      available: binaryExists,
      lastCollectionTime: engineService.lastCollectionTime,
      lastError: engineService.lastError,
    },
    platform: {
      os: os.type(),
      release: os.release(),
      arch: os.arch(),
      cpus: os.cpus().length,
      nodeVersion: process.version,
    },
  });
}

export async function getSystem(req, res) {
  try {
    let telemetry = engineService.latestTelemetry;
    if (!telemetry) {
      telemetry = await engineService.collectAndPersist();
    }

    if (!telemetry || !telemetry.system) {
      // Fallback to SQLite latest snapshot
      const row = await getLatestSnapshot();
      if (row) {
        return res.json({
          cpuUsage: row.cpu_usage,
          memoryUsage: row.memory_usage,
          totalMemoryMb: row.total_memory_mb,
          usedMemoryMb: row.used_memory_mb,
          availableMemoryMb: row.available_memory_mb,
          uptime: row.uptime,
          processCount: row.process_count,
          timestamp: row.created_at,
          source: 'database_fallback',
        });
      }
      return res.status(503).json({ error: 'System telemetry not available yet' });
    }

    res.json(telemetry.system);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getProcesses(req, res) {
  try {
    let telemetry = engineService.latestTelemetry;
    if (!telemetry) {
      telemetry = await engineService.collectAndPersist();
    }

    let list = telemetry.processes ? [...telemetry.processes] : [];

    // Filtering by search term (PID or process name)
    const search = (req.query.search || '').trim().toLowerCase();
    if (search) {
      list = list.filter((p) => {
        return (
          p.pid.toString().includes(search) ||
          (p.name && p.name.toLowerCase().includes(search))
        );
      });
    }

    // Risk filter
    const risk = (req.query.risk || '').trim().toUpperCase();
    if (risk && risk !== 'ALL') {
      list = list.filter((p) => p.risk && p.risk.toUpperCase() === risk);
    }

    // State filter
    const state = (req.query.state || '').trim().toLowerCase();
    if (state && state !== 'all') {
      list = list.filter((p) => p.state && p.state.toLowerCase() === state);
    }

    // Sorting
    const sortBy = req.query.sort || 'cpu';
    const order = (req.query.order || 'desc').toLowerCase();

    list.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
        return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
      return order === 'asc' ? valA - valB : valB - valA;
    });

    const total = list.length;
    const limit = parseInt(req.query.limit || '100', 10);
    const page = parseInt(req.query.page || '1', 10);
    const offset = (page - 1) * limit;

    const paginated = list.slice(offset, offset + limit);

    res.json({
      total,
      page,
      limit,
      processes: paginated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getTopProcesses(req, res) {
  try {
    let telemetry = engineService.latestTelemetry;
    if (!telemetry) {
      telemetry = await engineService.collectAndPersist();
    }

    const procs = telemetry.processes || [];
    const k = parseInt(req.query.k || '5', 10);

    const topCpu = [...procs]
      .sort((a, b) => (b.cpu || 0) - (a.cpu || 0))
      .slice(0, k);

    const topMemory = [...procs]
      .sort((a, b) => (b.memory || 0) - (a.memory || 0))
      .slice(0, k);

    res.json({
      topCpu,
      topMemory,
      count: procs.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getAlerts(req, res) {
  try {
    const severity = req.query.severity || null;
    const limit = parseInt(req.query.limit || '50', 10);

    // Get historical alerts from DB
    const persistedAlerts = await getRecentAlerts(limit, severity);

    // Active alerts from in-memory C++ engine run
    const activeAlerts = engineService.latestTelemetry?.alerts || [];

    res.json({
      active: activeAlerts,
      history: persistedAlerts,
      count: persistedAlerts.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getHistory(req, res) {
  try {
    const limit = parseInt(req.query.limit || '30', 10);
    const history = await getRecentSystemHistory(limit);
    const alerts = await getRecentAlerts(20);

    res.json({
      systemHistory: history.reverse(), // ascending order for chronological charts
      recentIncidents: alerts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function triggerMonitor(req, res) {
  try {
    const freshData = await engineService.collectAndPersist();
    res.status(201).json({
      message: 'Telemetry collected and persisted successfully',
      data: freshData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
