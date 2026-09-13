import { execFile } from 'child_process';
import fs from 'fs';
import { CONFIG } from '../config.js';
import { saveSnapshot } from '../database/db.js';

class EngineService {
  constructor() {
    this.latestTelemetry = null;
    this.lastError = null;
    this.lastCollectionTime = null;
    this.isCollecting = false;
    this.pollingTimer = null;
  }

  getBinaryPath() {
    // Check primary binary path
    if (fs.existsSync(CONFIG.ENGINE_BINARY_PATH)) {
      return CONFIG.ENGINE_BINARY_PATH;
    }

    // Alternative search paths
    const candidates = [
      './agent/processguard_engine.exe',
      './agent/processguard_engine',
      './agent/build/processguard_engine.exe',
      './agent/build/processguard_engine',
      '../agent/processguard_engine.exe',
      '../agent/processguard_engine',
      '../agent/build/processguard_engine.exe',
      '../agent/build/processguard_engine',
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return CONFIG.ENGINE_BINARY_PATH;
  }

  /**
   * Invokes the compiled C++ binary and returns parsed JSON.
   */
  async runEngine(intervalMs = CONFIG.SAMPLING_INTERVAL_MS, limit = CONFIG.MAX_PROCESSES) {
    const binary = this.getBinaryPath();

    if (!fs.existsSync(binary)) {
      throw new Error(
        `ProcessGuard C++ binary not found at '${binary}'. Please compile agent first.`
      );
    }

    const args = ['--interval', intervalMs.toString(), '--limit', limit.toString()];

    return new Promise((resolve, reject) => {
      execFile(binary, args, { maxBuffer: 10 * 1024 * 1024, timeout: 10000 }, (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(`C++ Engine execution failed: ${err.message}. Stderr: ${stderr}`));
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          if (!parsed.system || !Array.isArray(parsed.processes)) {
            return reject(new Error('Invalid JSON schema received from C++ engine.'));
          }
          resolve(parsed);
        } catch (jsonErr) {
          reject(new Error(`Failed to parse C++ Engine JSON output: ${jsonErr.message}. Output was: ${stdout.slice(0, 200)}...`));
        }
      });
    });
  }

  /**
   * Samples the C++ engine, updates cache, and persists to SQLite.
   */
  async collectAndPersist() {
    if (this.isCollecting) return this.latestTelemetry;
    this.isCollecting = true;

    try {
      const data = await this.runEngine();
      this.latestTelemetry = data;
      this.lastError = null;
      this.lastCollectionTime = new Date().toISOString();

      // Persist to SQLite
      await saveSnapshot(data);
      return data;
    } catch (err) {
      this.lastError = err.message;
      console.error(`[EngineService] Error collecting telemetry: ${err.message}`);
      throw err;
    } finally {
      this.isCollecting = false;
    }
  }

  /**
   * Starts background polling daemon.
   */
  startBackgroundPolling(intervalMs = CONFIG.POLL_INTERVAL_MS) {
    if (this.pollingTimer) return;

    // Run initial collection immediately
    this.collectAndPersist().catch((err) => {
      console.warn(`[EngineService] Initial telemetry sample warning: ${err.message}`);
    });

    this.pollingTimer = setInterval(async () => {
      try {
        await this.collectAndPersist();
      } catch (err) {
        // Logged inside collectAndPersist
      }
    }, intervalMs);

    console.log(`[EngineService] Background monitoring polling active (interval: ${intervalMs}ms)`);
  }

  stopBackgroundPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}

export const engineService = new EngineService();
