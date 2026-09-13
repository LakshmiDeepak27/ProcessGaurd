import React from 'react';

export default function StatCard({ title, value, subtext, meterPercent, meterColor = 'normal' }) {
  let barClass = 'normal';
  if (meterColor === 'warning' || (meterPercent >= 80 && meterPercent < 90)) {
    barClass = 'warning';
  } else if (meterColor === 'critical' || meterPercent >= 90) {
    barClass = 'critical';
  }

  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-title">{title}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-subtext">{subtext}</div>
      {typeof meterPercent === 'number' && (
        <div className="meter-track">
          <div
            className={`meter-bar ${barClass}`}
            style={{ width: `${Math.min(Math.max(meterPercent, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
