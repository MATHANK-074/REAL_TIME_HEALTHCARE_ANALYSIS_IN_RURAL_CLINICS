import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { 
  Users, 
  Activity, 
  Clock, 
  TrendingUp, 
  ArrowRight,
  User,
  ShieldAlert,
  RefreshCw,
  ClipboardList,
  Calendar
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const DoctorDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [followups, setFollowups] = useState([]);

  const loadDashboard = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      
      const [res, prData, fuData] = await Promise.all([
        api.getDoctorDashboard(),
        api.getPendingReviews().catch(() => []),
        api.getFollowups().catch(() => [])
      ]);
      
      setData(res);
      setPendingReviews(prData);
      setFollowups(fuData);
    } catch (e) {
      setError('Failed to fetch dashboard metrics: ' + (e.message || e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    
    // Auto-refresh doctor dashboard data every 8 seconds to reflect incoming screenings!
    const interval = setInterval(() => {
      loadDashboard(true);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading Dashboard Analytics...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="main-content" style={{ padding: '20px' }}>
        <div className="badge badge-danger" style={{ display: 'block', padding: '14px', width: '100%', borderRadius: '12px', textTransform: 'none', textAlign: 'center' }}>
          {error || 'No dashboard data available.'}
        </div>
      </div>
    );
  }

  const { kpis, high_risk_patients, location_breakdown } = data;

  const handleRowClick = (patientId) => {
    navigate(`/patients/${patientId}`);
  };

  return (
    <div className="main-content">
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
      <div className="header-bar">
        <div>
          <h1 className="header-title">Doctor Risk Assessment Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Clinical risk evaluation & jurisdiction tracking (Live Updates Active)
          </p>
        </div>
        <button 
          onClick={() => loadDashboard(true)} 
          className="btn btn-secondary"
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="glass kpi-card">
          <div className="kpi-header">
            <span>Total Patients</span>
            <div className="kpi-icon-wrapper" style={{ background: 'rgba(14, 165, 233, 0.1)', color: 'var(--primary)' }}>
              <Users size={18} />
            </div>
          </div>
          <div className="kpi-val">{kpis.total_patients}</div>
        </div>

        <div className="glass kpi-card" style={{ borderLeft: '3px solid var(--danger)' }}>
          <div className="kpi-header">
            <span>High Risk Patients</span>
            <div className="kpi-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
              <ShieldAlert size={18} />
            </div>
          </div>
          <div className="kpi-val" style={{ color: 'var(--danger)' }}>{kpis.high_risk}</div>
        </div>

        <div className="glass kpi-card" style={{ borderLeft: '3px solid var(--warning)' }}>
          <div className="kpi-header">
            <span>Medium Risk Patients</span>
            <div className="kpi-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
              <Activity size={18} />
            </div>
          </div>
          <div className="kpi-val" style={{ color: 'var(--warning)' }}>{kpis.medium_risk}</div>
        </div>

        <div className="glass kpi-card">
          <div className="kpi-header">
            <span>Pending Follow-ups</span>
            <div className="kpi-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--secondary)' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="kpi-val">{kpis.pending_followups}</div>
        </div>
      </div>

      {/* Main Dashboard Rows */}
      <div className="dashboard-row">
        {/* Table Side */}
        <div className="glass" style={{ padding: '24px' }}>
          <h3 className="chart-title">Jurisdiction High-Risk Actions List</h3>
          
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Location</th>
                  <th>Predicted Disease</th>
                  <th>Confidence</th>
                  <th>Assessed Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {high_risk_patients.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                      Great news! No patients currently classified as high-risk.
                    </td>
                  </tr>
                ) : (
                  high_risk_patients.map((hp) => (
                    <tr 
                      key={hp.patient_id} 
                      onClick={() => handleRowClick(hp.patient_id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div>
                          <div style={{ fontWeight: 600 }}>{hp.name}</div>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{hp.patient_code}</span>
                        </div>
                      </td>
                      <td>{hp.location}</td>
                      <td>
                        <span className="badge badge-danger">{hp.disease}</span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--danger)' }}>{Math.round(hp.probability * 100)}%</strong>
                      </td>
                      <td>{new Date(hp.predicted_at).toLocaleDateString()}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '6px 12px' }}>
                          Manage <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Breakdown side */}
        <div className="glass chart-card">
          <h3 className="chart-title">Patient Density by Village</h3>
          
          {location_breakdown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              No location breakdown data.
            </div>
          ) : (
            <div style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={location_breakdown}>
                  <XAxis dataKey="location" stroke="var(--text-secondary)" tickLine={false} />
                  <YAxis stroke="var(--text-secondary)" tickLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      background: '#ffffff', 
                      border: '1px solid var(--border-card)', 
                      borderRadius: '8px',
                      color: 'var(--text-primary)'
                    }} 
                  />
                  <Bar dataKey="patients" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-row" style={{ marginTop: '24px' }}>
        {/* Pending Reviews */}
        <div className="glass" style={{ padding: '24px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <ClipboardList color="var(--warning)" />
            <h3 className="chart-title" style={{ margin: 0 }}>Pending Health Reviews</h3>
          </div>
          
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient ID</th>
                  <th>Symptoms</th>
                  <th>Review Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingReviews.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                      No pending reviews.
                    </td>
                  </tr>
                ) : (
                  pendingReviews.map((pr) => (
                    <tr key={pr.id}>
                      <td>{new Date(pr.recorded_at).toLocaleDateString()}</td>
                      <td>{pr.patient_id}</td>
                      <td>{pr.symptoms || '-'}</td>
                      <td><span className="badge badge-warning">PENDING</span></td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleRowClick(pr.patient_id)}>
                          Review <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Follow-ups */}
        <div className="glass" style={{ padding: '24px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Calendar color="var(--secondary)" />
            <h3 className="chart-title" style={{ margin: 0 }}>Follow-ups Queue</h3>
          </div>
          
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient ID</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {followups.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                      No follow-ups.
                    </td>
                  </tr>
                ) : (
                  followups.map((fu) => (
                    <tr key={fu.id}>
                      <td>{new Date(fu.followup_date).toLocaleDateString()}</td>
                      <td>{fu.patient_id}</td>
                      <td>
                        <span className={`badge ${fu.priority === 'HIGH' || fu.priority === 'URGENT' ? 'badge-danger' : 'badge-primary'}`}>
                          {fu.priority || 'MEDIUM'}
                        </span>
                      </td>
                      <td>{fu.status}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleRowClick(fu.patient_id)}>
                          Open <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
