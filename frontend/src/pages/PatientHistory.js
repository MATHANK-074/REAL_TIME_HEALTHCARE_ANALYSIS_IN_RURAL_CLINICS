import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const PatientHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await api.patientPortal.getHistory();
      setHistory(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading your health history...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', color: '#1e293b' }}>Health History</h1>
      {error && <div className="badge badge-danger" style={{ marginBottom: '20px', padding: '10px' }}>{error}</div>}
      
      {history.length === 0 ? (
        <div style={{ padding: '30px', background: 'white', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
          No health records are available yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {history.map((item, idx) => (
            <div key={idx} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#334155' }}>
                  {new Date(item.record.recorded_at || item.record.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h3>
              </div>
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '15px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>BP</span>
                    <div style={{ fontWeight: 500 }}>{item.record.blood_pressure_systolic}/{item.record.blood_pressure_diastolic}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Pulse</span>
                    <div style={{ fontWeight: 500 }}>{item.record.heart_rate} bpm</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Weight</span>
                    <div style={{ fontWeight: 500 }}>{item.record.weight} kg</div>
                  </div>
                </div>
                
                {item.predictions && item.predictions.length > 0 && (
                  <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed #e2e8f0' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '8px' }}>AI Assessment Completed</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default PatientHistory;
