import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Overview from './pages/Overview';
import Processes from './pages/Processes';
import Alerts from './pages/Alerts';
import History from './pages/History';
import SystemInfo from './pages/SystemInfo';
import { fetchSystem, fetchTopProcesses, fetchAlerts, triggerSample } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [system, setSystem] = useState(null);
  const [topProcs, setTopProcs] = useState({ topCpu: [], topMemory: [] });
  const [alerts, setAlerts] = useState([]);
  const [isSampling, setIsSampling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [pollingError, setPollingError] = useState(null);

  const refreshTelemetry = useCallback(async () => {
    try {
      const [sysRes, topRes, alertsRes] = await Promise.all([
        fetchSystem(),
        fetchTopProcesses(5),
        fetchAlerts(),
      ]);

      setSystem(sysRes);
      setTopProcs(topRes);
      setAlerts(alertsRes.active || []);
      setLastUpdated(new Date().toLocaleTimeString());
      setPollingError(null);
    } catch (err) {
      console.warn('Telemetry poll error:', err.message);
      setPollingError(err.message);
    }
  }, []);

  // Polling loop every 4 seconds
  useEffect(() => {
    refreshTelemetry();
    const interval = setInterval(refreshTelemetry, 4000);
    return () => clearInterval(interval);
  }, [refreshTelemetry]);

  const handleTriggerSample = async () => {
    try {
      setIsSampling(true);
      await triggerSample();
      await refreshTelemetry();
    } catch (err) {
      alert(`Manual sample failed: ${err.message}`);
    } finally {
      setIsSampling(false);
    }
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={alerts.length}
        onTriggerSample={handleTriggerSample}
        isSampling={isSampling}
      />

      <main className="main-content">
        {pollingError && (
          <div style={{
            background: 'var(--accent-critical-bg)',
            border: '1px solid var(--accent-critical-border)',
            color: 'var(--accent-critical)',
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1rem',
            fontSize: '0.85rem'
          }}>
            Backend API Disconnected: {pollingError}. Ensure backend server is running on port 5000.
          </div>
        )}

        {activeTab === 'overview' && (
          <Overview
            system={system}
            topProcs={topProcs}
            alerts={alerts}
            onSelectProcess={() => setActiveTab('processes')}
          />
        )}
        {activeTab === 'processes' && <Processes />}
        {activeTab === 'alerts' && <Alerts />}
        {activeTab === 'history' && <History />}
        {activeTab === 'system' && <SystemInfo />}
      </main>

      <footer className="footer">
        <div>
          <span>ProcessGuard &bull; C++ Linux Kernel /proc Anomaly Detection Platform</span>
        </div>
        <div>
          <span>Last Poll: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{lastUpdated || 'Connecting...'}</strong></span>
        </div>
      </footer>
    </div>
  );
}
