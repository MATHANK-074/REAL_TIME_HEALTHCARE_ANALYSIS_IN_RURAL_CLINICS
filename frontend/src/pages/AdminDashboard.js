import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Building2, 
  Users, 
  UserCheck, 
  ShieldAlert, 
  Search
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [villageSearch, setVillageSearch] = useState('');
  const [selectedTaluk, setSelectedTaluk] = useState('ALL');

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

  const { kpis, disease_distribution, high_risk_by_disease, subdistrict_comparison, village_wise_risk = [], monthly_trend } = data;

  const OFFICIAL_TALUKS = [
    'Anthiyur',
    'Bhavani',
    'Erode',
    'Gobichettipalayam',
    'Kodumudi',
    'Modakkurichi',
    'Nambiyur',
    'Perundurai',
    'Sathyamangalam',
    'Thalavadi'
  ];

  const filteredVillages = (village_wise_risk || []).filter(vwr => {
    const matchesSearch = villageSearch.trim() === '' || 
      (vwr.name && vwr.name.toLowerCase().includes(villageSearch.trim().toLowerCase()));
    
    const matchesTaluk = selectedTaluk === 'ALL' || 
      (vwr.parent_name && vwr.parent_name.toLowerCase() === selectedTaluk.toLowerCase());

    return matchesSearch && matchesTaluk;
  });

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
        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 className="chart-title" style={{ margin: 0 }}>Village Wise Risk Distribution</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Showing {filteredVillages.length} of {village_wise_risk.length} villages
            </span>
          </div>

          {/* Search & Subdistrict/Taluk Filter Controls */}
          <div className="village-filter-controls">
            <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="text"
                placeholder="Search village name..."
                value={villageSearch}
                onChange={(e) => setVillageSearch(e.target.value)}
                className="input-field"
                style={{ 
                  paddingLeft: '34px', 
                  paddingTop: '8px', 
                  paddingBottom: '8px', 
                  fontSize: '0.85rem',
                  width: '100%' 
                }}
              />
            </div>
            <div style={{ position: 'relative', minWidth: '150px' }}>
              <select
                value={selectedTaluk}
                onChange={(e) => setSelectedTaluk(e.target.value)}
                className="input-field"
                style={{ 
                  paddingTop: '8px', 
                  paddingBottom: '8px', 
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  width: '100%',
                  background: '#ffffff'
                }}
              >
                <option value="ALL">All Taluks (10)</option>
                {OFFICIAL_TALUKS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Compact Table Container with Sticky Header */}
          <div className="compact-table-container">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '140px' }}>Village</th>
                  <th style={{ minWidth: '130px' }}>Subdistrict</th>
                  <th style={{ minWidth: '100px', textAlign: 'center' }}>Total Patients</th>
                  <th style={{ minWidth: '110px', textAlign: 'center' }}>High Risk</th>
                </tr>
              </thead>
              <tbody>
                {filteredVillages.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-secondary)' }}>
                      No villages matching <strong>"{villageSearch}"</strong> {selectedTaluk !== 'ALL' ? `in ${selectedTaluk} Taluk` : ''}.
                    </td>
                  </tr>
                ) : (
                  filteredVillages.map(vwr => (
                    <tr key={vwr.id}>
                      <td><strong>{vwr.name}</strong></td>
                      <td>{vwr.parent_name}</td>
                      <td style={{ textAlign: 'center' }}>{vwr.patients}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${vwr.high_risk > 0 ? 'badge-danger' : 'badge-success'}`}>
                          {vwr.high_risk} High Risk
                        </span>
                      </td>
                    </tr>
                  ))
                )}
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
