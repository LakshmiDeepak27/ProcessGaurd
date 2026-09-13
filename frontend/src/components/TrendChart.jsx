import React from 'react';

export default function TrendChart({ data = [], dataKey = 'cpu_usage', label = 'Metric', color = '#E2A03F' }) {
  if (!data || data.length === 0) {
    return (
      <div className="state-container">
        <p>No historical telemetry points recorded yet.</p>
      </div>
    );
  }

  const height = 180;
  const width = 600;
  const padding = 30;

  const values = data.map((d) => Number(d[dataKey]) || 0);
  const maxVal = Math.max(100, ...values);
  const minVal = 0;

  const points = values.map((val, idx) => {
    const x = padding + (idx / Math.max(values.length - 1, 1)) * (width - 2 * padding);
    const y = height - padding - ((val - minVal) / (maxVal - minVal)) * (height - 2 * padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  const latest = values[values.length - 1] || 0;
  const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        <span>Current: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{latest.toFixed(1)}%</strong></span>
        <span>Avg: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{avg}%</strong></span>
        <span>Peak: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{Math.max(...values).toFixed(1)}%</strong></span>
      </div>
      <div className="chart-container">
        <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--border-subtle)" strokeDasharray="3,3" />
          <line x1={padding} y1={(height - padding + padding) / 2} x2={width - padding} y2={(height - padding + padding) / 2} stroke="var(--border-subtle)" strokeDasharray="3,3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border-subtle)" />

          {/* Area fill */}
          <polygon points={areaPoints} fill={`url(#grad-${dataKey})`} />

          {/* Polyline */}
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Data dots */}
          {values.map((val, idx) => {
            const x = padding + (idx / Math.max(values.length - 1, 1)) * (width - 2 * padding);
            const y = height - padding - ((val - minVal) / (maxVal - minVal)) * (height - 2 * padding);
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r="3.5"
                fill="var(--bg-canvas)"
                stroke={color}
                strokeWidth="2"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
