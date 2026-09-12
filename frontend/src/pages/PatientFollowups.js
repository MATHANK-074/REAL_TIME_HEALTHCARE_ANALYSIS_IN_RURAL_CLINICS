import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const PatientFollowups = () => {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFollowups();
  }, []);

  const loadFollowups = async () => {
    try {
      setLoading(true);
      const res = await api.getFollowups(); 
      setFollowups(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading follow-ups...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', color: '#1e293b' }}>Follow-ups</h1>
      {error && <div className="badge badge-danger" style={{ marginBottom: '20px', padding: '10px' }}>{error}</div>}
      
      {followups.length === 0 ? (
        <div style={{ padding: '30px', background: 'white', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
          No upcoming follow-ups.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {followups.map((fup, idx) => {
            const isCompleted = fup.status === 'COMPLETED';
            return (
              <div key={idx} style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#334155' }}>
                    {new Date(fup.followup_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                    Purpose: {fup.reason || 'Health Review'}
                  </p>
                </div>
                <div style={{ background: isCompleted ? '#ecfdf5' : '#eff6ff', color: isCompleted ? '#10b981' : '#3b82f6', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                  {fup.status}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default PatientFollowups;
