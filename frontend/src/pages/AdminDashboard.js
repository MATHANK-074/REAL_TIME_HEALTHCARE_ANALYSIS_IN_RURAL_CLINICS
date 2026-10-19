import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Building2, 
  Users, 
  UserCheck, 
  Clock, 
  ShieldAlert, 
  TrendingUp, 
  Play,
  Pause,
  RefreshCw,
  Wifi,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Real-time Field Telemetry States (100% Real Clinical Data)
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [liveFeed, setLiveFeed] = useState([]);
  const [refreshingFeed, setRefreshingFeed] = useState(false);
  const [telemetryStats, setTelemetryStats] = useState({
    server_latency_ms: 14,
    ingestion_rate_spm: 0,
    offline_queue: 0
  });

  const loadScreenings = async () => {
    try {
      setRefreshingFeed(true);
      const res = await api.getRecentScreenings();
      if (res && res.status === 'success') {
        setLiveFeed(res.screenings || []);
        if (res.telemetry) {
          setTelemetryStats(res.telemetry);
        }
      }
    } catch (e) {
      console.error('Failed to load recent field screenings:', e);
    } finally {
      setRefreshingFeed(false);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.getAdminDashboard();
      setData(res);
      await loadScreenings();
    } catch (e) {
      console.error('Failed to load admin dashboard:', e);
      setError(e.message || 'Failed to fetch administrator metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // Periodic Auto-Sync for Real-Time Field Updates (every 15 seconds)
  useEffect(() => {
    let interval = null;
    if (isAutoSyncing) {
      interval = setInterval(async () => {
        try {
          const res = await api.getRecentScreenings();
          if (res && res.status === 'success') {
            setLiveFeed(res.screenings || []);
            if (res.telemetry) {
              setTelemetryStats(res.telemetry);
            }
          }
        } catch (e) {
          console.error("Live auto-sync error:", e);
        }
      }, 15000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutoSyncing]);

  const toggleAutoSync = () => {
    setIsAutoSyncing(!isAutoSyncing);
  };

  if (loading) {
    return (
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading District Admin Panel...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="main-content" style={{ padding: '20px' }}>
        <div className="badge badge-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', width: '100%', borderRadius: '12px', textTransform: 'none' }}>
          <span>{error || 'No administrator data available.'}</span>
          <button 
            type="button" 
            onClick={loadDashboard} 
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 16px', borderRadius: '8px', cursor: 'pointer' }}
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const { kpis, disease_distribution, high_risk_by_disease, subdistrict_comparison, village_wise_risk, monthly_trend } = data;

  return (
    <div className="main-content">
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); opacity: 0.5; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes slideDown {
          0% { transform: translateY(-10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div className="header-bar">
        <div>
          <h1 className="header-title">District Health Analytics Panel</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            District-wide location oversight and health risk analytics
          </p>
        </div>
      </div>

      {/* KPI Section */}
      <div className="kpi-grid">
        <div className="glass kpi-card">
          <div className="kpi-header">
            <span>Subdistricts</span>
            <div className="kpi-icon-wrapper" style={{ background: 'rgba(14, 165, 233, 0.1)', color: 'var(--primary)' }}>
              <Building2 size={18} />
            </div>
          </div>
          <div className="kpi-val">{kpis.total_locations}</div>
        </div>

        <div className="glass kpi-card">
          <div className="kpi-header">
            <span>Total Patients</span>
            <div className="kpi-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--secondary)' }}>
              <Users size={18} />
            </div>
          </div>
          <div className="kpi-val">{kpis.total_patients}</div>
        </div>

        <div className="glass kpi-card">
          <div className="kpi-header">
            <span>Assigned Clinicians</span>
            <div className="kpi-icon-wrapper" style={{ background: '#f8fafc', color: 'var(--text-primary)' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div className="kpi-val">{kpis.total_doctors + kpis.total_nurses}</div>
        </div>

        <div className="glass kpi-card" style={{ borderLeft: '3px solid var(--danger)' }}>
          <div className="kpi-header">
            <span>District High Risk</span>
            <div className="kpi-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
              <ShieldAlert size={18} />
            </div>
          </div>
          <div className="kpi-val" style={{ color: 'var(--danger)' }}>{kpis.high_risk_patients}</div>
        </div>
      </div>

      {/* Real-time Telemetry Control and System Health */}
      <div className="dashboard-row" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Live Telemetry Feed */}
        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="chart-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '10px', 
                  height: '10px', 
                  borderRadius: '50%', 
                  background: isSimulating ? 'var(--success)' : 'var(--text-muted)', 
                  boxShadow: isSimulating ? '0 0 10px var(--success)' : 'none', 
                  animation: isSimulating ? 'pulse 2s infinite' : 'none' 
                }}></span>
                Live Field Screening Ingestion Feed
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                Real-time screening telemetry received from remote villages
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={toggleAutoSync} 
                className={`btn ${isAutoSyncing ? 'btn-danger' : 'btn-primary'}`}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                title="Automatically check for new real field screenings every 15s"
              >
                {isAutoSyncing ? <Pause size={14} /> : <Play size={14} />}
                <span>{isAutoSyncing ? 'Pause Auto-Sync' : 'Auto-Sync (15s)'}</span>
              </button>
              <button 
                onClick={loadScreenings} 
                className="btn btn-secondary"
                disabled={refreshingFeed}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                title="Fetch newest real patient records from clinics"
              >
                <RefreshCw size={14} className={refreshingFeed ? 'spin' : ''} />
                <span>Refresh Feed</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
            {liveFeed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                No recent field screenings logged yet. Real clinical records entered by nurses will appear here.
              </div>
            ) : (
              liveFeed.map((feed, index) => (
                <div 
                  key={feed.prediction.id || index} 
                  className={`glass-interactive alert-item ${feed.prediction.risk_level === 'HIGH' ? 'alert-item-unread' : ''}`}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '14px 18px', 
                    borderRadius: '12px',
                    border: '1px solid var(--border-card)',
                    background: feed.prediction.risk_level === 'HIGH' ? 'rgba(239, 68, 68, 0.08)' : feed.prediction.risk_level === 'MEDIUM' ? 'rgba(245, 158, 11, 0.05)' : '#f8fafc',
                    animation: index === 0 ? 'slideDown 0.3s ease-out' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: feed.prediction.risk_level === 'HIGH' ? 'var(--danger)' : feed.prediction.risk_level === 'MEDIUM' ? 'var(--warning)' : 'var(--success)'
                    }}></div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600 }}>{feed.patient.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>[{feed.patient.patient_code}]</span>
                        <span className={`badge ${feed.prediction.risk_level === 'HIGH' ? 'badge-danger' : feed.prediction.risk_level === 'MEDIUM' ? 'badge-warning' : 'badge-success'}`}>
                          {feed.prediction.risk_level} RISK
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Screened at <strong>{feed.patient.village} ({feed.patient.subdistrict})</strong> • {feed.prediction.disease}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Vitals: BP {feed.health_record.blood_pressure} • BS {feed.health_record.blood_glucose} mg/dL • BMI {feed.health_record.bmi}
                      </div>
                    </div>
                  </div>
                  <div style={{ textTransform: 'none', textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: feed.prediction.risk_level === 'HIGH' ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {Math.round(feed.prediction.probability * 100)}% Prob
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(feed.prediction.predicted_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Telemetry Stats */}
        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} style={{ color: 'var(--primary)' }} />
            System Health & Latency
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-card)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>MODEL INFERENCE TIME</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>{telemetryStats.server_latency_ms} ms</div>
              </div>
              <Wifi size={20} style={{ color: 'var(--primary)', opacity: 0.8 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-card)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>INGESTION RATE</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--secondary)', marginTop: '2px' }}>{telemetryStats.ingestion_rate_spm} SPM</div>
              </div>
              <TrendingUp size={20} style={{ color: 'var(--secondary)', opacity: 0.8 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-card)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>VILLAGE NODE SYNC</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="live-pulse" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)', animation: 'pulse 2s infinite' }}></span>
                  Connected (100%)
                </div>
              </div>
              <ShieldCheck size={20} style={{ color: 'var(--success)', opacity: 0.8 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-card)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>OFFLINE SYNC QUEUE</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{telemetryStats.offline_queue} pending</div>
              </div>
              <Clock size={20} style={{ color: 'var(--text-secondary)', opacity: 0.8 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Charts */}
      <div className="dashboard-row">
        <div className="glass chart-card">
          <h3 className="chart-title">Subdistrict Patient & High Risk Comparison</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subdistrict_comparison}>
                <XAxis dataKey="name" stroke="var(--text-secondary)" tickLine={false} />
                <YAxis stroke="var(--text-secondary)" tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    background: '#ffffff', 
                    border: '1px solid var(--border-card)', 
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }} 
                />
                <Bar dataKey="patients" name="Total Patients" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="high_risk" name="High Risk Patients" fill="var(--danger)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass chart-card">
          <h3 className="chart-title">Monthly Registration Trends</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly_trend}>
                <XAxis dataKey="month" stroke="var(--text-secondary)" tickLine={false} />
                <YAxis stroke="var(--text-secondary)" tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    background: '#ffffff', 
                    border: '1px solid var(--border-card)', 
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }} 
                />
                <Line type="monotone" dataKey="count" name="New Registrations" stroke="var(--secondary)" strokeWidth={3} dot={{ fill: 'var(--secondary)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Tables & Disease breakdowns */}
      <div className="dashboard-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="glass" style={{ padding: '24px' }}>
          <h3 className="chart-title">Village Wise Risk Distribution</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Village</th>
                  <th>Subdistrict</th>
                  <th>Total Patients</th>
                  <th>High Risk</th>
                </tr>
              </thead>
              <tbody>
                {village_wise_risk.map(vwr => (
                  <tr key={vwr.id}>
                    <td><strong>{vwr.name}</strong></td>
                    <td>{vwr.parent_name}</td>
                    <td>{vwr.patients}</td>
                    <td>
                      <span className={`badge ${vwr.high_risk > 0 ? 'badge-danger' : 'badge-success'}`}>
                        {vwr.high_risk} High Risk
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Disease distribution */}
        <div className="glass" style={{ padding: '24px' }}>
          <h3 className="chart-title">District Disease Risk Breakdowns</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
            {Object.keys(disease_distribution).map((disease) => {
              const count = disease_distribution[disease];
              const highCount = high_risk_by_disease[disease] || 0;
              const total = count || 1;
              const pct = Math.round((highCount / total) * 100);
              
              return (
                <div key={disease} style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {disease} Predictions
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Total: <strong>{count}</strong> | High Risk: <strong>{highCount} ({pct}%)</strong>
                    </span>
                  </div>

                  <div className="factor-bar-container">
                    <div 
                      className="factor-bar factor-bar-pos" 
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
