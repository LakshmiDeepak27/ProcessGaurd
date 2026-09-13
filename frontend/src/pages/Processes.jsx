import React, { useState, useEffect } from 'react';
import Badge from '../components/Badge';
import { fetchProcesses } from '../services/api';

export default function Processes() {
  const [processes, setProcesses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('cpu');
  const [order, setOrder] = useState('desc');
  const [risk, setRisk] = useState('ALL');
  const [page, setPage] = useState(1);
  const limit = 25;

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchProcesses({ search, sort, order, risk, page, limit });
      setProcesses(res.processes || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, sort, order, risk, page]);

  const handleSort = (col) => {
    if (sort === col) {
      setOrder(order === 'desc' ? 'asc' : 'desc');
    } else {
      setSort(col);
      setOrder('desc');
    }
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>System Processes</h2>
          <p>Real-time process table populated from Linux /proc filesystem</p>
        </div>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing <strong>{processes.length}</strong> of <strong>{total}</strong> active processes
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="controls-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search by PID or process name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        <div className="filter-group">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>Risk:</span>
          {['ALL', 'NORMAL', 'WARNING', 'CRITICAL'].map((lvl) => (
            <button
              key={lvl}
              className={`filter-btn ${risk === lvl ? 'active' : ''}`}
              onClick={() => {
                setRisk(lvl);
                setPage(1);
              }}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: 0 }}>
        {loading ? (
          <div className="state-container">
            <p>Scanning processes...</p>
          </div>
        ) : error ? (
          <div className="state-container">
            <p style={{ color: 'var(--accent-critical)' }}>Failed to load processes: {error}</p>
          </div>
        ) : processes.length === 0 ? (
          <div className="state-container">
            <p>No processes match the query.</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => handleSort('pid')}>
                    PID {sort === 'pid' ? (order === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th className="sortable" onClick={() => handleSort('name')}>
                    Name {sort === 'name' ? (order === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th className="sortable" onClick={() => handleSort('cpu')}>
                    CPU % {sort === 'cpu' ? (order === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th className="sortable" onClick={() => handleSort('memory')}>
                    Memory % {sort === 'memory' ? (order === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th>Resident RSS</th>
                  <th>State</th>
                  <th>Lifetime</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((p) => (
                  <tr key={p.pid}>
                    <td className="mono-cell" style={{ fontWeight: 600 }}>{p.pid}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                    <td className="mono-cell" style={{ color: p.cpu >= 80 ? 'var(--accent-critical)' : 'var(--text-primary)' }}>
                      {p.cpu?.toFixed(1)}%
                    </td>
                    <td className="mono-cell">{p.memory?.toFixed(1)}%</td>
                    <td className="mono-cell">{Math.round((p.rssKb || 0) / 1024)} MB</td>
                    <td>
                      <span style={{ textTransform: 'capitalize' }}>{p.state}</span>
                    </td>
                    <td className="mono-cell" style={{ color: 'var(--text-muted)' }}>
                      {p.uptimeSec ? `${Math.floor(p.uptimeSec / 60)}m` : '< 1m'}
                    </td>
                    <td>
                      <Badge level={p.risk}>{p.risk}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button
            className="filter-btn"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          >
            Previous
          </button>
          <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>
          <button
            className="filter-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
