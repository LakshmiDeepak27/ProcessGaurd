import React from 'react';

export default function Badge({ level, children }) {
  const norm = (level || children || 'normal').toLowerCase();
  let badgeClass = 'badge-normal';

  if (norm.includes('crit')) {
    badgeClass = 'badge-critical';
  } else if (norm.includes('warn')) {
    badgeClass = 'badge-warning';
  } else if (norm.includes('info')) {
    badgeClass = 'badge-info';
  }

  return (
    <span className={`badge ${badgeClass}`}>
      {children || level}
    </span>
  );
}
