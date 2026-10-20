import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { 
  Building2, 
  Users, 
  UserCheck, 
  ShieldAlert, 
  Search,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Eye,
  X,
  RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [villageSearch, setVillageSearch] = useState('');
  const [selectedTaluk, setSelectedTaluk] = useState('ALL');

  // Follow-ups States & Filters
  const [followups, setFollowups] = useState([]);
  const [followupsLoading, setFollowupsLoading] = useState(false);
  const [followupSearch, setFollowupSearch] = useState('');
  const [followupTaluk, setFollowupTaluk] = useState('ALL');
  const [followupVillage, setFollowupVillage] = useState('ALL');
  const [followupStatus, setFollowupStatus] = useState('ALL');
  const [followupStartDate, setFollowupStartDate] = useState('');
  const [followupEndDate, setFollowupEndDate] = useState('');
  const [selectedFollowupDetail, setSelectedFollowupDetail] = useState(null);

  const loadFollowups = useCallback(async () => {
    try {
      setFollowupsLoading(true);
      const res = await api.getFollowups();
      setFollowups(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error('Failed to load follow-ups:', e);
    } finally {
      setFollowupsLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [dashRes] = await Promise.all([
        api.getAdminDashboard(),
        loadFollowups()
      ]);
      setData(dashRes);
    } catch (e) {
      console.error('Failed to load admin dashboard:', e);
      setError(e.message || 'Failed to fetch administrator metrics.');
    } finally {
      setLoading(false);
    }
  }, [loadFollowups]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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
    'Erode',
    'Perundurai',
    'Modakkurichi',
    'Kodumudi',
    'Gobichettipalayam',
    'Sathyamangalam',
    'Bhavani',
    'Anthiyur',
    'Thalavadi',
    'Nambiyur'
  ];

  const officialVillageCount = (village_wise_risk || []).filter(v => v.is_official !== false && !v.is_legacy).length;
  const legacyVillageCount = (village_wise_risk || []).filter(v => v.is_legacy === true).length;

  const filteredVillages = (village_wise_risk || []).filter(vwr => {
    const matchesSearch = villageSearch.trim() === '' || 
      (vwr.name && vwr.name.toLowerCase().includes(villageSearch.trim().toLowerCase()));
    
    const matchesTaluk = selectedTaluk === 'ALL' || 
      (vwr.parent_name && vwr.parent_name.toLowerCase() === selectedTaluk.toLowerCase());

    return matchesSearch && matchesTaluk;
  });

  // Dynamic village list for the selected follow-up taluk
  const followupVillagesList = (village_wise_risk || [])
    .filter(v => followupTaluk === 'ALL' || (v.parent_name && v.parent_name.toLowerCase() === followupTaluk.toLowerCase()))
    .map(v => v.name)
    .sort();

  // Helper function to determine live follow-up status & overdue days
  const getFollowupComputedStatus = (f) => {
    const rawStatus = (f.status || 'PENDING').toUpperCase();
    if (rawStatus === 'COMPLETED') {
      return { key: 'COMPLETED', label: 'Completed', badgeClass: 'badge-completed', overdueDays: 0 };
    }
    if (rawStatus === 'CANCELLED') {
      return { key: 'CANCELLED', label: 'Cancelled', badgeClass: 'badge-cancelled', overdueDays: 0 };
    }

    // For active/pending follow-ups, evaluate against today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fDate = new Date(f.followup_date);
    fDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - fDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return { 
        key: 'OVERDUE', 
        label: `Overdue by ${diffDays}d`, 
        badgeClass: 'badge-overdue', 
        overdueDays: diffDays 
      };
    } else if (diffDays === 0) {
      return { key: 'DUE_TODAY', label: 'Due Today', badgeClass: 'badge-due-today', overdueDays: 0 };
    } else {
      return { key: 'UPCOMING', label: 'Upcoming', badgeClass: 'badge-upcoming', overdueDays: 0 };
    }
  };

  // Follow-up Summary Counts from actual backend data
  const followupSummary = followups.reduce((acc, f) => {
    const comp = getFollowupComputedStatus(f);
    acc.total += 1;
    if (comp.key === 'COMPLETED') acc.completed += 1;
    else if (comp.key === 'DUE_TODAY') acc.dueToday += 1;
    else if (comp.key === 'OVERDUE') acc.overdue += 1;
    else if (comp.key === 'UPCOMING') acc.upcoming += 1;
    else if (comp.key === 'CANCELLED') acc.cancelled += 1;
    return acc;
  }, { total: 0, dueToday: 0, overdue: 0, completed: 0, upcoming: 0, cancelled: 0 });

  // Filter follow-ups by search, taluk, village, status, and date range
  const filteredFollowups = followups.filter(f => {
    // Patient Search (name or code)
    if (followupSearch.trim()) {
      const q = followupSearch.trim().toLowerCase();
      const name = (f.patient_name || '').toLowerCase();
      const code = (f.patient_code || '').toLowerCase();
      if (!name.includes(q) && !code.includes(q)) return false;
    }

    // Taluk Filter
    if (followupTaluk !== 'ALL') {
      const taluk = (f.subdistrict_name || '').toLowerCase();
      if (taluk !== followupTaluk.toLowerCase()) return false;
    }

    // Village Filter
    if (followupVillage !== 'ALL') {
      const vil = (f.village_name || '').toLowerCase();
      if (vil !== followupVillage.toLowerCase()) return false;
    }

    // Status Filter
    if (followupStatus !== 'ALL') {
      const comp = getFollowupComputedStatus(f);
      if (comp.key !== followupStatus && (f.status || '').toUpperCase() !== followupStatus) {
        return false;
      }
    }

    // Date Range Filters
    if (followupStartDate) {
      const fDateStr = new Date(f.followup_date).toISOString().split('T')[0];
      if (fDateStr < followupStartDate) return false;
    }
    if (followupEndDate) {
      const fDateStr = new Date(f.followup_date).toISOString().split('T')[0];
      if (fDateStr > followupEndDate) return false;
    }

    return true;
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
          <div style={{ height: '320px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subdistrict_comparison} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
                <XAxis 
                  dataKey="name" 
                  stroke="var(--text-secondary)" 
                  tickLine={false} 
                  interval={0} 
                  angle={-35} 
                  textAnchor="end" 
                  height={60} 
                  tick={{ fontSize: 11 }}
                />
                <YAxis stroke="var(--text-secondary)" tickLine={false} allowDecimals={false} />
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
          <div style={{ height: '320px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly_trend} margin={{ top: 10, right: 20, left: -10, bottom: 40 }}>
                <XAxis 
                  dataKey="month" 
                  stroke="var(--text-secondary)" 
                  tickLine={false} 
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 11 }}
                />
                <YAxis stroke="var(--text-secondary)" tickLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ 
                    background: '#ffffff', 
                    border: '1px solid var(--border-card)', 
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  name="New Registrations" 
                  stroke="var(--secondary)" 
                  strokeWidth={3} 
                  dot={{ fill: 'var(--secondary)', r: 4 }} 
                  activeDot={{ r: 6 }} 
                />
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
              Showing {filteredVillages.length} of {village_wise_risk.length} villages ({officialVillageCount} official, {legacyVillageCount} legacy)
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
                      <td>
                        <strong>{vwr.name}</strong>
                        {vwr.is_legacy && (
                          <span 
                            style={{ 
                              marginLeft: '8px', 
                              padding: '2px 6px', 
                              fontSize: '0.7rem', 
                              borderRadius: '4px', 
                              background: '#fef3c7', 
                              color: '#92400e', 
                              fontWeight: 600 
                            }}
                          >
                            Legacy
                          </span>
                        )}
                      </td>
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

      {/* Row 3: My Area Follow-ups Monitoring Interface */}
      <div className="glass" style={{ padding: '24px', marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="chart-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} style={{ color: 'var(--primary)' }} />
              My Area Follow-ups
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
              District-wide patient follow-up tracking, scheduling verification, and clinical review oversight
            </p>
          </div>
          <button 
            type="button"
            onClick={loadFollowups} 
            className="btn btn-secondary btn-sm"
            disabled={followupsLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={followupsLoading ? 'spin' : ''} />
            <span>Refresh Follow-ups</span>
          </button>
        </div>

        {/* STEP 2: Summary Cards */}
        <div className="followup-summary-grid">
          <div className="glass kpi-card" style={{ padding: '16px' }}>
            <div className="kpi-header">
              <span style={{ fontSize: '0.85rem' }}>Total Follow-ups</span>
              <div className="kpi-icon-wrapper" style={{ background: 'rgba(14, 165, 233, 0.1)', color: 'var(--primary)' }}>
                <Calendar size={16} />
              </div>
            </div>
            <div className="kpi-val" style={{ fontSize: '1.5rem', marginTop: '4px' }}>{followupSummary.total}</div>
          </div>

          <div className="glass kpi-card" style={{ padding: '16px', borderLeft: '3px solid #f97316' }}>
            <div className="kpi-header">
              <span style={{ fontSize: '0.85rem' }}>Due Today</span>
              <div className="kpi-icon-wrapper" style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#f97316' }}>
                <Clock size={16} />
              </div>
            </div>
            <div className="kpi-val" style={{ fontSize: '1.5rem', marginTop: '4px', color: '#c2410c' }}>{followupSummary.dueToday}</div>
          </div>

          <div className="glass kpi-card" style={{ padding: '16px', borderLeft: '3px solid var(--danger)' }}>
            <div className="kpi-header">
              <span style={{ fontSize: '0.85rem' }}>Overdue</span>
              <div className="kpi-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                <AlertTriangle size={16} />
              </div>
            </div>
            <div className="kpi-val" style={{ fontSize: '1.5rem', marginTop: '4px', color: 'var(--danger)' }}>{followupSummary.overdue}</div>
          </div>

          <div className="glass kpi-card" style={{ padding: '16px', borderLeft: '3px solid var(--secondary)' }}>
            <div className="kpi-header">
              <span style={{ fontSize: '0.85rem' }}>Completed</span>
              <div className="kpi-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--secondary)' }}>
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="kpi-val" style={{ fontSize: '1.5rem', marginTop: '4px', color: 'var(--secondary)' }}>{followupSummary.completed}</div>
          </div>
        </div>

        {/* STEP 3: Search and Filters */}
        <div className="followup-filter-grid">
          {/* Patient Search */}
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text"
              placeholder="Search patient name or ID (e.g. RH-0001)..."
              value={followupSearch}
              onChange={(e) => setFollowupSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '34px', paddingTop: '8px', paddingBottom: '8px', fontSize: '0.85rem', width: '100%' }}
            />
          </div>

          {/* Taluk Filter */}
          <div>
            <select
              value={followupTaluk}
              onChange={(e) => {
                setFollowupTaluk(e.target.value);
                setFollowupVillage('ALL'); // Reset village selection when taluk changes
              }}
              className="input-field"
              style={{ paddingTop: '8px', paddingBottom: '8px', fontSize: '0.85rem', width: '100%', background: '#ffffff', cursor: 'pointer' }}
            >
              <option value="ALL">All Taluks (10)</option>
              {OFFICIAL_TALUKS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Dependent Village Filter */}
          <div>
            <select
              value={followupVillage}
              onChange={(e) => setFollowupVillage(e.target.value)}
              className="input-field"
              style={{ paddingTop: '8px', paddingBottom: '8px', fontSize: '0.85rem', width: '100%', background: '#ffffff', cursor: 'pointer' }}
            >
              <option value="ALL">All Villages {followupTaluk !== 'ALL' ? `in ${followupTaluk}` : ''}</option>
              {followupVillagesList.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={followupStatus}
              onChange={(e) => setFollowupStatus(e.target.value)}
              className="input-field"
              style={{ paddingTop: '8px', paddingBottom: '8px', fontSize: '0.85rem', width: '100%', background: '#ffffff', cursor: 'pointer' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="DUE_TODAY">Due Today</option>
              <option value="OVERDUE">Overdue</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Date Range Inputs */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input 
              type="date"
              value={followupStartDate}
              onChange={(e) => setFollowupStartDate(e.target.value)}
              title="Start Date"
              className="input-field"
              style={{ padding: '6px 8px', fontSize: '0.8rem', width: '100%', background: '#ffffff' }}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>–</span>
            <input 
              type="date"
              value={followupEndDate}
              onChange={(e) => setFollowupEndDate(e.target.value)}
              title="End Date"
              className="input-field"
              style={{ padding: '6px 8px', fontSize: '0.8rem', width: '100%', background: '#ffffff' }}
            />
          </div>

          {/* Reset Filters Button */}
          {(followupSearch || followupTaluk !== 'ALL' || followupVillage !== 'ALL' || followupStatus !== 'ALL' || followupStartDate || followupEndDate) && (
            <button
              type="button"
              onClick={() => {
                setFollowupSearch('');
                setFollowupTaluk('ALL');
                setFollowupVillage('ALL');
                setFollowupStatus('ALL');
                setFollowupStartDate('');
                setFollowupEndDate('');
              }}
              className="btn btn-secondary btn-sm"
              style={{ padding: '7px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* STEP 4 & 5: Compact Table Container with Sticky Header */}
        <div className="compact-table-container">
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ minWidth: '150px' }}>Patient</th>
                <th style={{ minWidth: '150px' }}>Taluk & Village</th>
                <th style={{ minWidth: '180px' }}>Reason / Clinical Notes</th>
                <th style={{ minWidth: '130px' }}>Scheduled Date</th>
                <th style={{ minWidth: '130px' }}>Assigned Doctor</th>
                <th style={{ minWidth: '120px', textAlign: 'center' }}>Status</th>
                <th style={{ minWidth: '90px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredFollowups.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
                    No follow-ups matching the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredFollowups.map(fup => {
                  const compStatus = getFollowupComputedStatus(fup);
                  return (
                    <tr key={fup.id || fup._id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{fup.patient_name || 'Patient'}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {fup.patient_code || `ID: ${String(fup.patient_id).slice(-6)}`}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{fup.subdistrict_name || 'Taluk'}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {fup.village_name || 'Village'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {fup.reason || fup.notes || 'Routine Clinical Review'}
                        </div>
                        {fup.priority && fup.priority !== 'MEDIUM' && (
                          <span style={{ fontSize: '0.72rem', color: fup.priority === 'HIGH' ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: 600 }}>
                            Priority: {fup.priority}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {new Date(fup.followup_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(fup.followup_date).toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          {fup.doctor_name || 'Assigned Clinician'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${compStatus.badgeClass}`} style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                          {compStatus.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedFollowupDetail(fup)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="View Follow-up Details"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Follow-up Detail Modal */}
      {selectedFollowupDetail && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(15, 23, 42, 0.4)', 
          backdropFilter: 'blur(4px)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass" style={{ background: '#ffffff', maxWidth: '520px', width: '100%', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-card)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: 'var(--primary)' }} />
                Follow-up Details
              </h3>
              <button 
                type="button" 
                onClick={() => setSelectedFollowupDetail(null)} 
                className="btn btn-secondary btn-sm" 
                style={{ padding: '4px 8px', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Patient:</span>
                <strong>{selectedFollowupDetail.patient_name || 'Patient'} [{selectedFollowupDetail.patient_code || '—'}]</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Territory:</span>
                <strong>{selectedFollowupDetail.village_name || 'Village'}, {selectedFollowupDetail.subdistrict_name || 'Taluk'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Scheduled Date:</span>
                <strong>{new Date(selectedFollowupDetail.followup_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Assigned Doctor:</span>
                <strong>{selectedFollowupDetail.doctor_name || 'Doctor'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                <span className={`badge ${getFollowupComputedStatus(selectedFollowupDetail).badgeClass}`}>
                  {getFollowupComputedStatus(selectedFollowupDetail).label}
                </span>
              </div>

              {selectedFollowupDetail.reason && (
                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Reason:</div>
                  <div style={{ fontWeight: 500 }}>{selectedFollowupDetail.reason}</div>
                </div>
              )}

              {selectedFollowupDetail.notes && (
                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Clinical Notes:</div>
                  <div style={{ fontWeight: 500 }}>{selectedFollowupDetail.notes}</div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setSelectedFollowupDetail(null)} 
                className="btn btn-primary btn-sm"
                style={{ padding: '8px 20px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
