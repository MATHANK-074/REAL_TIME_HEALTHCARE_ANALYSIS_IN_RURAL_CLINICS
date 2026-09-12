import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { 
  ArrowLeft, Activity, Calendar, ShieldAlert, CheckCircle, 
  FileText, Clock, ChevronRight, Stethoscope
} from 'lucide-react';

const DoctorClinicalReview = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReview();
  }, [patientId]);

  const loadReview = async () => {
    try {
      setLoading(true);
      const res = await api.clinicalReviews.getReview(patientId);
      setData(res);
    } catch (e) {
      setError(e.message || 'Failed to load clinical review');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!decision) return alert('Please select a decision.');
    if ((decision === 'MODIFY' || decision === 'DISMISS') && !notes) {
      return alert('Notes are required for Modify or Dismiss decisions.');
    }
    
    try {
      setSubmitting(true);
      await api.clinicalReviews.submitDecision(data.recommendation.id, decision, notes);
      alert('Decision submitted successfully.');
      navigate('/doctor');
    } catch (e) {
      alert(e.message || 'Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-container"><p>Loading clinical review...</p></div>;
  if (error) return <div className="page-container"><p style={{color: 'red'}}>{error}</p></div>;
  if (!data) return <div className="page-container"><p>No data found.</p></div>;

  const { patient, health_record, recommendation } = data;
  
  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '24px' }}>
        <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ padding: '8px' }}>
          <ArrowLeft size={18} />
        </button>
        <h2 className="page-title" style={{ margin: 0 }}>Clinical Review: {patient.name}</h2>
        <span className={`badge ${recommendation.overall_priority === 'URGENT' || recommendation.overall_priority === 'HIGH' ? 'badge-danger' : 'badge-primary'}`}>
          {recommendation.overall_priority} PRIORITY
        </span>
      </div>

      <div className="dashboard-row">
        {/* Left Column: Patient & Vitals */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Patient Overview */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 className="chart-title">Patient Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Patient Code</div>
                <div style={{ fontWeight: 500 }}>{patient.patient_code}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Age / Gender</div>
                <div style={{ fontWeight: 500 }}>{patient.age} / {patient.gender}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Blood Group</div>
                <div style={{ fontWeight: 500 }}>{patient.blood_group || 'N/A'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Contact</div>
                <div style={{ fontWeight: 500 }}>{patient.phone || 'N/A'}</div>
              </div>
            </div>
            {patient.existing_disease && (
              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <strong style={{ color: '#d97706' }}>Existing Conditions:</strong> {patient.existing_disease}
              </div>
            )}
          </div>

          {/* Vitals */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 className="chart-title">Latest Health Record</h3>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Recorded on: {new Date(health_record.recorded_at).toLocaleString()}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Blood Pressure</div>
                <div style={{ fontWeight: 500 }}>{health_record.systolic_bp || '-'}/{health_record.diastolic_bp || '-'} mmHg</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Heart Rate</div>
                <div style={{ fontWeight: 500 }}>{health_record.heart_rate || '-'} bpm</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Blood Glucose</div>
                <div style={{ fontWeight: 500 }}>{health_record.blood_glucose || '-'} mg/dL</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>BMI</div>
                <div style={{ fontWeight: 500 }}>{health_record.bmi ? Number(health_record.bmi).toFixed(1) : '-'}</div>
              </div>
            </div>

            {health_record.symptoms && (
              <div style={{ marginTop: '20px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Reported Symptoms:</strong>
                <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>{health_record.symptoms}</p>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: AI Risk & Decision */}
        <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* AI Risk Overview */}
          <div className="glass" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Activity color="var(--primary)" />
              <h3 className="chart-title" style={{ margin: 0 }}>AI Risk Assessment</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {recommendation.condition_results.map((cond, idx) => (
                <div key={idx} style={{ 
                  padding: '16px', 
                  borderRadius: '12px', 
                  border: `1px solid ${cond.risk_level === 'HIGH' || cond.risk_level === 'URGENT' ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-card)'}`,
                  background: cond.risk_level === 'HIGH' || cond.risk_level === 'URGENT' ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 600 }}>{cond.disease}</div>
                    <span className={`badge ${cond.risk_level === 'HIGH' || cond.risk_level === 'URGENT' ? 'badge-danger' : cond.risk_level === 'MODERATE' ? 'badge-warning' : 'badge-primary'}`}>
                      {cond.risk_level}
                    </span>
                  </div>
                  
                  {cond.probability !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ flex: 1, height: '6px', background: 'var(--border-card)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${Math.round(cond.probability * 100)}%`,
                          background: cond.risk_level === 'HIGH' || cond.risk_level === 'URGENT' ? 'var(--danger)' : 'var(--primary)'
                        }}></div>
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '35px' }}>
                        {Math.round(cond.probability * 100)}%
                      </div>
                    </div>
                  )}

                  {cond.factors && cond.factors.length > 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <strong>Key factors:</strong> {cond.factors.map(f => f.feature_name).join(', ')}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      {cond.error ? 'Model unavailable.' : 'No detailed factors available.'}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>Clinical Support Engine Summary:</strong>
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)' }}>
                {recommendation.clinical_attention.map((att, i) => <li key={i}>{att}</li>)}
              </ul>
            </div>
          </div>

          {/* Doctor Decision Form */}
          <div className="glass" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Stethoscope color="var(--primary)" />
              <h3 className="chart-title" style={{ margin: 0 }}>Doctor Decision</h3>
            </div>
            
            {recommendation.status !== 'PENDING_REVIEW' ? (
              <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: 'var(--secondary)' }}>
                <strong>Review Completed:</strong> {recommendation.status} by Doctor
                {recommendation.doctor_notes && <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>Notes: {recommendation.doctor_notes}</p>}
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <label className="form-label">Decision</label>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="radio" name="decision" value="APPROVE" checked={decision === 'APPROVE'} onChange={(e) => setDecision(e.target.value)} />
                      Approve AI Assessment
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="radio" name="decision" value="MODIFY" checked={decision === 'MODIFY'} onChange={(e) => setDecision(e.target.value)} />
                      Modify Assessment
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="radio" name="decision" value="DISMISS" checked={decision === 'DISMISS'} onChange={(e) => setDecision(e.target.value)} />
                      Dismiss
                    </label>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label className="form-label">Clinical Notes {(decision === 'MODIFY' || decision === 'DISMISS') && <span style={{ color: 'red' }}>*</span>}</label>
                  <textarea 
                    className="form-input" 
                    rows="4" 
                    placeholder="Enter clinical notes, treatment plan, or reason for modification..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => navigate('/doctor')}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Decision'}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default DoctorClinicalReview;
