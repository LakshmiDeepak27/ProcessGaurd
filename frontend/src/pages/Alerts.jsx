import React, { useState, useEffect } from 'react';
import Badge from '../components/Badge';
import { fetchAlerts } from '../services/api';

export default function Alerts() {
  const [alertsData, setAlertsData] = useState({ active: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAlerts(severityFilter === 'ALL' ? null : severityFilter);
      setAlertsData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [severityFilter]);

  const active = alertsData.active || [];
  const history = alertsData.history || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Anomaly Detection & Alerts</h2>
          <p>Rule-based detection for high CPU, critical memory, and sustained resource consumption</p>
        </div>
        <div className="filter-group">
          {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
            <button
              key={sev}
              className={`filter-btn ${severityFilter === sev ? 'active' : ''}`}
              onClick={() => setSeverityFilter(sev)}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Active Anomalies Section */}
      <div className="panel">
        <div className="panel-title">
          <span>Active Anomalies ({active.length})</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Evaluated by ProcessAnalyzer</span>
        </div>

        {loading ? (
          <div className="state-container">
            <p>Evaluating active alerts...</p>
          </div>
        ) : error ? (
          <div className="state-container">
            <p style={{ color: 'var(--accent-critical)' }}>Failed to load alerts: {error}</p>
          </div>
        ) : active.length === 0 ? (
          <div className="state-container">
            <p>No active anomalies currently detected. All processes operating within nominal parameters.</p>
          </div>
        ) : (
          active.map((a, idx) => (
            <div key={idx} className={`alert-card ${a.severity.toLowerCase()}`}>
              <div>
                <div className="alert-header-row">
                  <Badge level={a.severity}>{a.severity}</Badge>
                  <span className="alert-process-name">{a.name}</span>
                  <span className="alert-pid">PID {a.pid}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>[{a.eventType}]</span>
                </div>
                <div className="alert-message">{a.message}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Recorded CPU: <strong style={{ fontFamily: 'var(--font-mono)' }}>{a.cpu?.toFixed(1)}%</strong> |
                  Recorded Memory: <strong style={{ fontFamily: 'var(--font-mono)' }}>{a.memory?.toFixed(1)}%</strong>
                </div>
              </div>
              <div className="alert-time">
                {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : 'Just now'}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Persisted Historical Incident Log from SQLite */}
      <div className="panel">
        <div className="panel-title">
          <span>Historical Incident Log ({history.length})</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Persisted in SQLite database</span>
        </div>

        {history.length === 0 ? (
          <div className="state-container">
            <p>No historical incidents stored in database.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Severity</th>
                  <th>Process</th>
                  <th>PID</th>
                  <th>Event</th>
                  <th>Recorded CPU</th>
                  <th>Recorded Mem</th>
                  <th>Incident Message</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="mono-cell" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {h.created_at}
                    </td>
                    <td>
                      <Badge level={h.severity}>{h.severity}</Badge>
                    </td>
                    <td style={{ fontWeight: 600 }}>{h.process_name}</td>
                    <td className="mono-cell">{h.pid}</td>
                    <td className="mono-cell">{h.event_type}</td>
                    <td className="mono-cell">{h.cpu_usage?.toFixed(1)}%</td>
                    <td className="mono-cell">{h.memory_usage?.toFixed(1)}%</td>
                    <td style={{ fontSize: '0.82rem' }}>{h.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
