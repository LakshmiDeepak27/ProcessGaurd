import React, { useState, useEffect } from 'react';
import TrendChart from '../components/TrendChart';
import Badge from '../components/Badge';
import { fetchHistory } from '../services/api';

export default function History() {
  const [historyData, setHistoryData] = useState({ systemHistory: [], recentIncidents: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchHistory(40);
      setHistoryData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const history = historyData.systemHistory || [];
  const incidents = historyData.recentIncidents || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Telemetry History & Incident Analysis</h2>
          <p>Historical trends and recurring abnormal process patterns persisted in SQLite</p>
        </div>
        <button className="filter-btn" onClick={loadHistory} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh History'}
        </button>
      </div>

      {loading ? (
        <div className="state-container">
          <p>Querying SQLite telemetry database...</p>
        </div>
      ) : error ? (
        <div className="state-container">
          <p style={{ color: 'var(--accent-critical)' }}>Failed to load history: {error}</p>
        </div>
      ) : (
        <>
          {/* Trend Charts */}
          <div className="two-col-grid">
            <div className="panel">
              <div className="panel-title">
                <span>CPU Utilization History</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Last {history.length} snapshots</span>
              </div>
              <TrendChart
                data={history}
                dataKey="cpu_usage"
                label="CPU Usage"
                color="#E2A03F"
              />
            </div>

            <div className="panel">
              <div className="panel-title">
                <span>Memory Consumption History</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Last {history.length} snapshots</span>
              </div>
              <TrendChart
                data={history}
                dataKey="memory_usage"
                label="Memory Usage"
                color="#63B3ED"
              />
            </div>
          </div>

          {/* Incident Timeline */}
          <div className="panel">
            <div className="panel-title">
              <span>Repeated Incidents & Abnormal Spikes</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Audit trail</span>
            </div>

            {incidents.length === 0 ? (
              <div className="state-container">
                <p>No abnormal incidents recorded in the persistence layer.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Process Name</th>
                      <th>PID</th>
                      <th>Anomaly Type</th>
                      <th>Severity</th>
                      <th>CPU %</th>
                      <th>Memory %</th>
                      <th>Diagnosis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc) => (
                      <tr key={inc.id}>
                        <td className="mono-cell" style={{ color: 'var(--text-muted)' }}>{inc.created_at}</td>
                        <td style={{ fontWeight: 600 }}>{inc.process_name}</td>
                        <td className="mono-cell">{inc.pid}</td>
                        <td className="mono-cell">{inc.event_type}</td>
                        <td>
                          <Badge level={inc.severity}>{inc.severity}</Badge>
                        </td>
                        <td className="mono-cell" style={{ color: inc.cpu_usage > 80 ? 'var(--accent-critical)' : 'inherit' }}>
                          {inc.cpu_usage?.toFixed(1)}%
                        </td>
                        <td className="mono-cell">{inc.memory_usage?.toFixed(1)}%</td>
                        <td style={{ fontSize: '0.82rem' }}>{inc.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
