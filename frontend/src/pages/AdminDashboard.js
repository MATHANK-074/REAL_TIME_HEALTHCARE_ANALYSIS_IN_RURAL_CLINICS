import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Building2, 
  Users, 
  UserCheck, 
  Clock, 
  ShieldAlert, 
  TrendingUp 
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.getAdminDashboard();
      setData(res);
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
