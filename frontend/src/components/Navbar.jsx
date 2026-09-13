import React from 'react';

export default function Navbar({ activeTab, setActiveTab, alertCount, onTriggerSample, isSampling }) {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'processes', label: 'Processes' },
    { id: 'alerts', label: 'Alerts', count: alertCount },
    { id: 'history', label: 'History' },
    { id: 'system', label: 'System Info' },
  ];

  return (
    <nav className="navbar">
      <div className="brand-section">
        <div className="brand-logo">PG</div>
        <div className="brand-titles">
          <h1>ProcessGuard</h1>
          <span>Detect. Analyze. Understand.</span>
        </div>
      </div>

      <ul className="nav-links">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <button
              className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.count > 0 && <span className="badge-count">{tab.count}</span>}
            </button>
          </li>
        ))}
      </ul>

      <div className="nav-actions">
        <div className="live-indicator">
          <span className="dot-pulse"></span>
          <span>LIVE ENGINE</span>
        </div>
        <button
          className="btn-primary"
          onClick={onTriggerSample}
          disabled={isSampling}
        >
          {isSampling ? 'Sampling...' : 'Sample Now'}
        </button>
      </div>
    </nav>
  );
}
