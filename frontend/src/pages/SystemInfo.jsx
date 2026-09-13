import React, { useState, useEffect } from 'react';
import Badge from '../components/Badge';
import { fetchHealth, fetchSystem } from '../services/api';

export default function SystemInfo() {
  const [health, setHealth] = useState(null);
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const [h, s] = await Promise.all([fetchHealth(), fetchSystem()]);
      setHealth(h);
      setSystem(s);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInfo();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>System Information & Architecture</h2>
          <p>Host runtime diagnostics, hardware specs, and C++ engine linkage</p>
        </div>
        <button className="filter-btn" onClick={loadInfo} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Info'}
        </button>
      </div>

      {loading ? (
        <div className="state-container">
          <p>Gathering system diagnostics...</p>
        </div>
      ) : error ? (
        <div className="state-container">
          <p style={{ color: 'var(--accent-critical)' }}>Failed to fetch system info: {error}</p>
        </div>
      ) : (
        <div className="two-col-grid">
          {/* C++ Monitoring Engine Status */}
          <div className="panel">
            <div className="panel-title">
              <span>C++ Engine Subsystem</span>
              <Badge level={health?.engine?.available ? 'NORMAL' : 'CRITICAL'}>
                {health?.engine?.available ? 'ONLINE' : 'OFFLINE'}
              </Badge>
            </div>
            <table className="data-table">
              <tbody>
                <tr>
                  <td>Binary Location</td>
                  <td className="mono-cell" style={{ wordBreak: 'break-all' }}>{health?.engine?.binaryPath}</td>
                </tr>
                <tr>
                  <td>Status</td>
                  <td>
                    <Badge level={health?.engine?.available ? 'NORMAL' : 'CRITICAL'}>
                      {health?.engine?.available ? 'Executable Verified' : 'Binary Missing'}
                    </Badge>
                  </td>
                </tr>
                <tr>
                  <td>Last Telemetry Sample</td>
                  <td className="mono-cell">{health?.engine?.lastCollectionTime || 'N/A'}</td>
                </tr>
                <tr>
                  <td>Engine Error State</td>
                  <td className="mono-cell" style={{ color: health?.engine?.lastError ? 'var(--accent-critical)' : 'var(--accent-normal)' }}>
                    {health?.engine?.lastError || 'None (Healthy)'}
                  </td>
                </tr>
                <tr>
                  <td>Engine Architecture</td>
                  <td>Modern C++17, OOP Composition, DSA Priority Queue</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Operating System & Host Environment */}
          <div className="panel">
            <div className="panel-title">
              <span>Host Environment & Kernel</span>
              <Badge level="INFO">{health?.platform?.os || 'Linux'}</Badge>
            </div>
            <table className="data-table">
              <tbody>
                <tr>
                  <td>OS Kernel / Release</td>
                  <td className="mono-cell">{health?.platform?.release}</td>
                </tr>
                <tr>
                  <td>Architecture</td>
                  <td className="mono-cell">{health?.platform?.arch}</td>
                </tr>
                <tr>
                  <td>CPU Logical Cores</td>
                  <td className="mono-cell">{health?.platform?.cpus} Cores</td>
                </tr>
                <tr>
                  <td>Node.js Runtime</td>
                  <td className="mono-cell">{health?.platform?.nodeVersion}</td>
                </tr>
                <tr>
                  <td>Daemon Uptime</td>
                  <td className="mono-cell">{health?.uptime} seconds</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Memory Topology */}
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <div className="panel-title">
              <span>Memory Topology</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Parsed from /proc/meminfo or system API</span>
            </div>
            <div className="stats-grid" style={{ marginBottom: 0 }}>
              <div className="stat-card" style={{ background: 'var(--bg-inset)' }}>
                <span className="stat-title">Total Memory</span>
                <span className="stat-value">{system?.totalMemoryMb || 0} MB</span>
                <span className="stat-subtext">Physical RAM configured</span>
              </div>
              <div className="stat-card" style={{ background: 'var(--bg-inset)' }}>
                <span className="stat-title">Used Memory</span>
                <span className="stat-value" style={{ color: 'var(--accent-amber)' }}>{system?.usedMemoryMb || 0} MB</span>
                <span className="stat-subtext">{system?.memoryUsage?.toFixed(1)}% active allocation</span>
              </div>
              <div className="stat-card" style={{ background: 'var(--bg-inset)' }}>
                <span className="stat-title">Available Memory</span>
                <span className="stat-value" style={{ color: 'var(--accent-normal)' }}>{system?.availableMemoryMb || 0} MB</span>
                <span className="stat-subtext">Available for unbuffered allocations</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
