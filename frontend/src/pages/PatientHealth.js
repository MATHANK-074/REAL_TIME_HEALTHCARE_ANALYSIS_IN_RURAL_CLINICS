import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const PatientHealth = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    try {
      setLoading(true);
      const res = await api.patientPortal.getHealth();
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading your health information...</div>;

  const record = data?.latest_visit;

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', color: '#1e293b' }}>My Health</h1>
      {error && <div className="badge badge-danger" style={{ marginBottom: '20px', padding: '10px' }}>{error}</div>}
      
      {!record ? (
        <div style={{ padding: '30px', background: 'white', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
          No health records are available yet.
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#334155' }}>
              Latest Visit: {new Date(record.recorded_at || record.created_at).toLocaleDateString()}
            </h2>
          </div>
          
          <div style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '15px', color: '#475569' }}>Vitals</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '25px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Blood Pressure</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>{record.blood_pressure_systolic}/{record.blood_pressure_diastolic} <small style={{fontWeight:400, color:'#94a3b8'}}>mmHg</small></span>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Pulse</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>{record.heart_rate} <small style={{fontWeight:400, color:'#94a3b8'}}>bpm</small></span>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Weight</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>{record.weight} <small style={{fontWeight:400, color:'#94a3b8'}}>kg</small></span>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Blood Sugar</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>{record.blood_sugar || 'N/A'} <small style={{fontWeight:400, color:'#94a3b8'}}></small></span>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '15px', color: '#475569' }}>Symptoms</h3>
            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              {record.symptoms && record.symptoms.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {record.symptoms.map((sym, i) => (
                    <span key={i} style={{ background: '#e2e8f0', padding: '4px 10px', borderRadius: '12px', fontSize: '0.85rem', color: '#334155' }}>
                      {sym}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ color: '#64748b' }}>No specific symptoms recorded.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PatientHealth;
