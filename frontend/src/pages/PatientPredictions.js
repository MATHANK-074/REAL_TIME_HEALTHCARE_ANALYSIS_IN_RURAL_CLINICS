import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldAlert } from 'lucide-react';

const PatientPredictions = () => {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async () => {
    try {
      setLoading(true);
      const res = await api.patientPortal.getPredictions();
      setPredictions(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading AI assessments...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', color: '#1e293b' }}>AI Health Risk Summary</h1>
      
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', marginBottom: '25px', display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
        <ShieldAlert style={{ color: '#0ea5e9', flexShrink: 0 }} size={24} />
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
          <strong>Notice:</strong> AI-generated risk information is intended to support healthcare professionals and is not a diagnosis. Your doctor remains the final clinical decision-maker.
        </p>
      </div>

      {error && <div className="badge badge-danger" style={{ marginBottom: '20px', padding: '10px' }}>{error}</div>}
      
      {predictions.length === 0 ? (
        <div style={{ padding: '30px', background: 'white', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
          No recent AI assessment is available.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {predictions.map((pred, idx) => {
            const riskLower = pred.risk_level?.toLowerCase() || '';
            let riskColor = '#10b981'; // LOW
            let riskBg = '#ecfdf5';
            if (riskLower === 'high') {
              riskColor = '#ef4444';
              riskBg = '#fef2f2';
            } else if (riskLower === 'moderate' || riskLower === 'medium') {
              riskColor = '#f59e0b';
              riskBg = '#fffbeb';
            }

            return (
              <div key={idx} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#334155' }}>{pred.model_name || 'Health Assessment'}</h3>
                
                <div style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '20px', background: riskBg, color: riskColor, fontWeight: 700, fontSize: '0.9rem', marginBottom: '15px' }}>
                  {(pred.risk_level || 'UNKNOWN').toUpperCase()} RISK
                </div>
                
                <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                  {pred.safe_message}
                </p>
                <div style={{ marginTop: '15px', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Assessment Date: {new Date(pred.predicted_at).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default PatientPredictions;
