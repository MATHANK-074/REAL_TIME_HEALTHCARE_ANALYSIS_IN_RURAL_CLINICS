import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Activity, Calendar, FileText, CheckCircle2, Bell, BellOff } from 'lucide-react';
import { checkPushSupport, subscribeUserToPush, unsubscribeUserFromPush, getPushSubscriptionStatus } from '../services/pushNotifications';

const PatientDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [pushLoading, setPushLoading] = useState(false);
  
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    loadDashboard();
    checkPushStatus();
  }, []);

  const checkPushStatus = async () => {
    if (!checkPushSupport()) {
      setPushSupported(false);
      return;
    }
    const status = await getPushSubscriptionStatus();
    setPushEnabled(status);
  };

  const handleTogglePush = async () => {
    try {
      setPushLoading(true);
      if (pushEnabled) {
        await unsubscribeUserFromPush();
        setPushEnabled(false);
      } else {
        await subscribeUserToPush();
        setPushEnabled(true);
      }
    } catch (err) {
      alert(err.message || "Failed to change notification settings");
    } finally {
      setPushLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.patientPortal.getDashboard();
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading your health dashboard...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {error && <div className="badge badge-danger" style={{ marginBottom: '20px', padding: '10px' }}>{error}</div>}
      
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#1e293b' }}>Good morning, {user?.name}</h1>
        <p style={{ color: '#64748b' }}>Here is your personal health overview.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '8px' }}>
              <CheckCircle2 style={{ color: '#10b981' }} size={20} />
            </div>
            <h3 style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Latest Assessment</h3>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155' }}>
            {data?.latest_assessment_status || 'No recent assessment available.'}
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ background: '#f0f9ff', padding: '8px', borderRadius: '8px' }}>
              <Activity style={{ color: '#0ea5e9' }} size={20} />
            </div>
            <h3 style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Health Attention</h3>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155' }}>
            {data?.health_attention || 'Normal'}
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ background: '#fef2f2', padding: '8px', borderRadius: '8px' }}>
              <Calendar style={{ color: '#ef4444' }} size={20} />
            </div>
            <h3 style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Next Follow-up</h3>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155' }}>
            {data?.next_followup_date ? new Date(data.next_followup_date).toLocaleDateString() : 'No upcoming follow-ups.'}
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '8px' }}>
              <FileText style={{ color: '#64748b' }} size={20} />
            </div>
            <h3 style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Last Visit</h3>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155' }}>
            {data?.last_visit_date ? new Date(data.last_visit_date).toLocaleDateString() : 'No recent visit.'}
          </div>
        </div>

      </div>

      {/* Notification Settings */}
      <div style={{ marginTop: '30px', background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', marginBottom: '16px' }}>Notifications</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <p style={{ color: '#475569', margin: 0, fontWeight: 500 }}>Browser notifications</p>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px', marginBottom: 0 }}>
              {!pushSupported 
                ? 'Browser notifications are not supported on this device.' 
                : pushEnabled 
                  ? '✓ Notifications enabled' 
                  : 'Notifications are currently disabled.'}
            </p>
          </div>
          {pushSupported && (
            <button 
              onClick={handleTogglePush}
              disabled={pushLoading}
              className={pushEnabled ? "btn btn-secondary" : "btn btn-primary"}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {pushEnabled ? <BellOff size={18} /> : <Bell size={18} />}
              {pushLoading ? 'Updating...' : pushEnabled ? 'Disable notifications' : 'Enable notifications'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default PatientDashboard;
