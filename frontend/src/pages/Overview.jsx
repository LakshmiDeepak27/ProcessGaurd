import React from 'react';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';

export default function Overview({ system, topProcs, alerts, onSelectProcess }) {
  if (!system) {
    return (
      <div className="state-container">
        <p>Awaiting system telemetry from C++ monitoring engine...</p>
      </div>
    );
  }

  const formatUptime = (sec) => {
    if (!sec) return '0s';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${s}s`;
    if (mins > 0) return `${mins}m ${s}s`;
    return `${s}s`;
  };

  const activeAlertCount = alerts?.length || 0;
  const topCpu = topProcs?.topCpu?.[0] || null;
  const topMem = topProcs?.topMemory?.[0] || null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>System Overview</h2>
          <p>Real-time OS resource metrics and active anomaly state</p>
        </div>
        <div>
          <Badge level={activeAlertCount > 0 ? 'CRITICAL' : 'NORMAL'}>
            {activeAlertCount > 0 ? `${activeAlertCount} Anomalies Active` : 'System Nominal'}
          </Badge>
        </div>
      </div>

      {/* Top Stat Cards Grid */}
      <div className="stats-grid">
        <StatCard
          title="CPU Utilization"
          value={`${system.cpuUsage?.toFixed(1) || 0}%`}
          subtext="Aggregate Kernel + User"
          meterPercent={system.cpuUsage}
        />
        <StatCard
          title="Memory Consumption"
          value={`${system.memoryUsage?.toFixed(1) || 0}%`}
          subtext={`${system.usedMemoryMb || 0} MB of ${system.totalMemoryMb || 0} MB`}
          meterPercent={system.memoryUsage}
        />
        <StatCard
          title="Monitored Processes"
          value={system.processCount || 0}
          subtext="Active in /proc table"
        />
        <StatCard
          title="System Uptime"
          value={formatUptime(system.uptime)}
          subtext={`Booted at ${new Date(Date.now() - (system.uptime || 0) * 1000).toLocaleTimeString()}`}
        />
      </div>

      {/* Two Column Section: Top Resource Consumers */}
      <div className="two-col-grid">
        <div className="panel">
          <div className="panel-title">
            <span>Top CPU Consumer</span>
            {topCpu && <Badge level={topCpu.risk}>{topCpu.risk}</Badge>}
          </div>
          {topCpu ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{topCpu.name}</span>
                <span className="mono-cell" style={{ color: 'var(--text-muted)' }}>PID {topCpu.pid}</span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                CPU Usage: <strong style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{topCpu.cpu?.toFixed(1)}%</strong> |
                Memory: <strong style={{ fontFamily: 'var(--font-mono)' }}>{topCpu.memory?.toFixed(1)}%</strong> ({Math.round(topCpu.rssKb / 1024)} MB)
              </p>
              <div className="meter-track">
                <div
                  className="meter-bar warning"
                  style={{ width: `${Math.min(topCpu.cpu, 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No process data available</p>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            <span>Top Memory Consumer</span>
            {topMem && <Badge level={topMem.risk}>{topMem.risk}</Badge>}
          </div>
          {topMem ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{topMem.name}</span>
                <span className="mono-cell" style={{ color: 'var(--text-muted)' }}>PID {topMem.pid}</span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                Memory Usage: <strong style={{ color: 'var(--accent-info)', fontFamily: 'var(--font-mono)' }}>{topMem.memory?.toFixed(1)}%</strong> ({Math.round(topMem.rssKb / 1024)} MB) |
                CPU: <strong style={{ fontFamily: 'var(--font-mono)' }}>{topMem.cpu?.toFixed(1)}%</strong>
              </p>
              <div className="meter-track">
                <div
                  className="meter-bar normal"
                  style={{ width: `${Math.min(topMem.memory, 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No process data available</p>
          )}
        </div>
      </div>

      {/* Top 5 CPU Table */}
      <div className="panel">
        <div className="panel-title">
          <span>Priority Queue Top Consumers (Max-Heap)</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>C++ std::priority_queue O(N log K)</span>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>Process Name</th>
                <th>CPU %</th>
                <th>Memory %</th>
                <th>Resident Memory</th>
                <th>State</th>
                <th>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {topProcs?.topCpu?.slice(0, 5).map((p) => (
                <tr key={p.pid}>
                  <td className="mono-cell">{p.pid}</td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td className="mono-cell" style={{ color: p.cpu > 80 ? 'var(--accent-critical)' : 'var(--text-primary)' }}>
                    {p.cpu?.toFixed(1)}%
                  </td>
                  <td className="mono-cell">{p.memory?.toFixed(1)}%</td>
                  <td className="mono-cell">{Math.round((p.rssKb || 0) / 1024)} MB</td>
                  <td>
                    <span style={{ textTransform: 'capitalize' }}>{p.state}</span>
                  </td>
                  <td>
                    <Badge level={p.risk}>{p.risk}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
