import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  Heart, 
  Activity, 
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  PlusCircle,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const PatientDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [fieldVisits, setFieldVisits] = useState([]);
  
  // Followups State
  const [followups, setFollowups] = useState([]);
  const [fDate, setFDate] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [fPriority, setFPriority] = useState('MEDIUM');
  const [fReason, setFReason] = useState('');
  
  // Review State
  const [reviewStatus, setReviewStatus] = useState('REVIEWED');
  const [reviewNotes, setReviewNotes] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadPatientData = async () => {
    try {
      setLoading(true);
      
      const pData = await api.getPatient(id);
      setPatient(pData);
      
      const rData = await api.getPatientRecords(id);
      setRecords(rData);
      
      const predData = await api.getPatientPredictions(id);
      setPredictions(predData);
      if (predData.length > 0) {
        // Select latest prediction by default
        setSelectedPrediction(predData[0]);
      }
      
      // Load patient followups
      const allFollowups = await api.getFollowups();
      setFollowups(allFollowups.filter(f => f.patient_id === id));
      
      // Load field visits
      const visits = await api.getFieldVisits('', id);
      setFieldVisits(visits);
    } catch (e) {
      setError('Failed to load patient profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatientData();
  }, [id]);

  const handleCreateFollowup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      // Create followup
      await api.createFollowup({
        patient_id: id,
        followup_date: fDate,
        notes: fNotes || null,
        priority: fPriority,
        reason: fReason || null
      });
      
      setSuccess('Follow-up scheduled successfully!');
      setFDate('');
      setFNotes('');
      setFPriority('MEDIUM');
      setFReason('');
      
      // Reload followups
      const allFollowups = await api.getFollowups();
      setFollowups(allFollowups.filter(f => f.patient_id === id));
    } catch (err) {
      setError(err.message || 'Failed to schedule follow-up.');
    }
  };

  const handleToggleFollowup = async (fid, currentStatus) => {
    const nextStatus = currentStatus === 'PENDING' ? 'COMPLETED' : 'PENDING';
    try {
      await api.updateFollowupStatus(fid, nextStatus);
      setFollowups(prev => prev.map(f => f.id === fid ? { ...f, status: nextStatus } : f));
    } catch (e) {
      setError('Failed to update follow-up status.');
    }
  };

  const handleReviewRecord = async (recordId) => {
    try {
      await api.reviewHealthRecord(recordId, {
        review_status: reviewStatus,
        doctor_notes: reviewNotes
      });
      setSuccess('Health record review submitted successfully!');
      setReviewNotes('');
      setReviewStatus('REVIEWED');
      
      // Reload records to clear pending status
      const rData = await api.getPatientRecords(id);
      setRecords(rData);
    } catch (e) {
      setError(e.message || 'Failed to submit review.');
    }
  };

  if (loading) {
    return (
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading Patient Case File...</div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="main-content" style={{ padding: '20px' }}>
        <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ marginBottom: '20px' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="badge badge-danger" style={{ display: 'block', padding: '14px', width: '100%', borderRadius: '12px', textTransform: 'none', textAlign: 'center' }}>
          {error || 'Patient profile not found.'}
        </div>
      </div>
    );
  }

  // Pre-format chart data (oldest to newest)
  const chartData = [...records].reverse().map(r => ({
    date: new Date(r.recorded_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    systolic: r.systolic_bp,
    diastolic: r.diastolic_bp,
    glucose: r.blood_glucose,
    heartRate: r.heart_rate
  }));

  return (
    <div className="main-content">
      {/* Navigation and Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Registered in {patient.area?.name || 'Area'} / {patient.clinic?.clinic_name || 'Clinic'}
        </span>
      </div>

      {success && (
        <div className="badge badge-success" style={{ display: 'block', padding: '14px', width: '100%', marginBottom: '20px', borderRadius: '12px', textTransform: 'none', textAlign: 'center' }}>
          {success}
        </div>
      )}

      {/* Patient Vitals Header */}
      <div className="glass" style={{ padding: '30px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '30px', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-card)', paddingRight: '30px' }}>
          <div className="avatar" style={{ width: '70px', height: '70px', fontSize: '2rem', margin: '0 auto 15px' }}>
            {patient.name.substring(0, 2)}
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{patient.name}</h2>
          <span className="badge badge-info" style={{ marginTop: '8px' }}>{patient.patient_code}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Age / Gender</span>
            <div style={{ fontWeight: 600, fontSize: '1.05rem', marginTop: '4px' }}>{patient.age} yrs / {patient.gender}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Mobile Phone</span>
            <div style={{ fontWeight: 600, fontSize: '1.05rem', marginTop: '4px' }}>{patient.phone || 'N/A'}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Area / Clinic</span>
            <div style={{ fontWeight: 600, fontSize: '1.05rem', marginTop: '4px' }}>{patient.area_name || 'Unassigned Area'} / {patient.clinic_name || 'Unassigned Clinic'}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Village / District</span>
            <div style={{ fontWeight: 600, fontSize: '1.05rem', marginTop: '4px' }}>{patient.village || 'N/A'}, {patient.district || 'N/A'}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Assigned Nurse / Doctor</span>
            <div style={{ fontWeight: 600, fontSize: '1.05rem', marginTop: '4px', color: 'var(--primary)' }}>{patient.assigned_nurse || 'None'} / {patient.assigned_doctor || 'None'}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Medical History / Allergies</span>
            <div style={{ fontWeight: 600, fontSize: '1.05rem', marginTop: '4px', color: 'var(--danger)' }}>{patient.existing_disease || 'None'} | {patient.allergies || 'None'}</div>
          </div>
        </div>
      </div>

      {/* Main Content Layout Grid */}
      <div className="dashboard-row">
        {/* Left Side: Vitals Charting and Follow-ups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Vitals chart */}
          <div className="glass chart-card">
            <h3 className="chart-title">Clinical Vitals History Trends</h3>
            {chartData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-secondary)' }}>
                No vitals history logs recorded for this patient.
              </div>
            ) : (
              <div style={{ height: '280px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" stroke="var(--text-secondary)" tickLine={false} />
                    <YAxis stroke="var(--text-secondary)" tickLine={false} />
                    <Tooltip 
                      contentStyle={{ 
                        background: '#ffffff', 
                        border: '1px solid var(--border-card)', 
                        borderRadius: '8px',
                        color: 'var(--text-primary)'
                      }} 
                    />
                    <Line type="monotone" dataKey="systolic" name="Systolic BP" stroke="var(--danger)" strokeWidth={2.5} dot={true} />
                    <Line type="monotone" dataKey="diastolic" name="Diastolic BP" stroke="var(--warning)" strokeWidth={2} dot={true} />
                    <Line type="monotone" dataKey="glucose" name="Glucose" stroke="var(--primary)" strokeWidth={2} dot={true} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Chronological Health History */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 className="chart-title">Chronological Health History</h3>
            <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vitals (BP/HR/Temp)</th>
                    <th>Glucose/Cholesterol</th>
                    <th>Weight/BMI</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    records.map(r => (
                      <tr key={r.id}>
                        <td><strong>{new Date(r.recorded_at).toLocaleDateString()}</strong></td>
                        <td>{r.systolic_bp}/{r.diastolic_bp} mmHg | {r.heart_rate} bpm | {r.temperature}°F</td>
                        <td>{r.blood_glucose} mg/dL | {r.cholesterol || '-'}</td>
                        <td>{r.weight} kg | BMI: {r.bmi ? r.bmi.toFixed(1) : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Field Visits Log */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 className="chart-title">Field Visits Log</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldVisits.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                        No field visits recorded.
                      </td>
                    </tr>
                  ) : (
                    fieldVisits.map(v => (
                      <tr key={v.id}>
                        <td><strong>{new Date(v.created_at).toLocaleDateString()}</strong></td>
                        <td>
                          <span className={`badge ${v.status === 'COMPLETED' ? 'badge-success' : v.status === 'CANCELLED' ? 'badge-danger' : 'badge-warning'}`}>
                            {v.status}
                          </span>
                        </td>
                        <td>{v.visit_notes || 'No notes'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Follow-up Planner Scheduler */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 className="chart-title">Doctor's Follow-up Calendar Scheduler</h3>
            
            <form onSubmit={handleCreateFollowup} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto', gap: '15px', alignItems: 'end', marginBottom: '25px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Date</label>
                <input 
                  type="date" 
                  className="form-control" 
                  required 
                  value={fDate} 
                  onChange={(e) => setFDate(e.target.value)} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Priority</label>
                <select className="form-control" value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Reason</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. BP Check" 
                  value={fReason} 
                  onChange={(e) => setFReason(e.target.value)} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Directives / Notes</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Review blood glucose levels..." 
                  value={fNotes} 
                  onChange={(e) => setFNotes(e.target.value)} 
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '12px 20px' }}>
                <PlusCircle size={18} /> Schedule
              </button>
            </form>

            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Scheduled Consultations Log
            </h4>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Priority</th>
                    <th>Reason</th>
                    <th>Directives</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {followups.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        No follow-ups scheduled currently.
                      </td>
                    </tr>
                  ) : (
                    followups.map(f => (
                      <tr key={f.id}>
                        <td><strong>{new Date(f.followup_date).toLocaleDateString()}</strong></td>
                        <td>
                          <span className={`badge ${f.priority === 'HIGH' || f.priority === 'URGENT' ? 'badge-danger' : 'badge-primary'}`}>
                            {f.priority || 'MEDIUM'}
                          </span>
                        </td>
                        <td>{f.reason || '-'}</td>
                        <td style={{ fontSize: '0.85rem' }}>{f.notes || 'No notes added'}</td>
                        <td>
                          <span className={`badge ${f.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                            {f.status}
                          </span>
                        </td>
                        <td>
                          <button 
                            className={`btn ${f.status === 'COMPLETED' ? 'btn-secondary' : 'btn-primary'}`} 
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => handleToggleFollowup(f.id, f.status)}
                          >
                            Mark {f.status === 'PENDING' ? 'Done' : 'Pending'}
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

        {/* Right Side: AI Risk Prediction & Clinical Review */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* DOCTOR REVIEW SECTION */}
          {records.length > 0 && records[0].review_status === 'PENDING_REVIEW' && (
            <div className="glass" style={{ padding: '24px', border: '2px solid var(--warning)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <AlertTriangle color="var(--warning)" />
                <h3 className="chart-title" style={{ margin: 0 }}>Pending Health Review</h3>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
                New vitals were logged on {new Date(records[0].recorded_at).toLocaleString()}. Please review and add clinical notes.
              </p>
              
              <div className="form-group">
                <label className="form-label">Review Assessment</label>
                <select className="form-control" value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                  <option value="REVIEWED">Mark as Reviewed</option>
                  <option value="NEEDS_FOLLOWUP">Requires Follow-up</option>
                  <option value="ESCALATED">Escalate (High Risk)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Doctor's Clinical Notes</label>
                <textarea 
                  className="form-control" 
                  rows="3" 
                  placeholder="Add your assessment notes here..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                ></textarea>
              </div>
              
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={() => handleReviewRecord(records[0].id)}
              >
                Submit Review
              </button>
            </div>
          )}

          {/* AI Assessment card */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 className="chart-title">AI Predictive Diagnosis</h3>
            
            {predictions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                No predictions computed yet. Log vitals to trigger.
              </div>
            ) : (
              <div>
                {/* Selector for prediction history */}
                <div style={{ marginBottom: '20px' }}>
                  <label className="form-label">Select Prediction Run</label>
                  <select 
                    className="form-control"
                    value={selectedPrediction?.id || ''}
                    onChange={(e) => {
                      const sel = predictions.find(p => p.id === e.target.value);
                      setSelectedPrediction(sel);
                    }}
                  >
                    {predictions.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.disease} - {new Date(p.predicted_at).toLocaleDateString()} ({p.risk_level})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPrediction && (
                  <div>
                    {/* Confidence Meter */}
                    <div style={{
                      background: selectedPrediction.risk_level === 'HIGH' ? 'rgba(239, 68, 68, 0.08)' : selectedPrediction.risk_level === 'MEDIUM' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid ' + (selectedPrediction.risk_level === 'HIGH' ? 'rgba(239, 68, 68, 0.15)' : selectedPrediction.risk_level === 'MEDIUM' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center',
                      marginBottom: '20px'
                    }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>RISK INTENSITY LEVEL</span>
                      <h2 style={{ 
                        fontSize: '1.6rem', 
                        fontWeight: 800, 
                        color: selectedPrediction.risk_level === 'HIGH' ? 'var(--danger)' : selectedPrediction.risk_level === 'MEDIUM' ? 'var(--warning)' : 'var(--success)',
                        margin: '4px 0'
                      }}>{selectedPrediction.risk_level}</h2>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        Prediction probability: <strong>{Math.round(selectedPrediction.probability * 100)}%</strong>
                      </span>
                    </div>

                    {/* Local explainability factors list (SHAP local impact) */}
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      Contributing Local Vitals Impact (SHAP local weight)
                    </h4>
                    
                    <div className="factors-list">
                      {selectedPrediction.factors && selectedPrediction.factors.length > 0 ? (
                        selectedPrediction.factors.map(f => {
                          const val = parseFloat(f.importance);
                          // Since local contributions are normalized, we map to % width
                          const widthPct = Math.min(100, Math.round(val * 200)); // double it for display visibility if normalized to 0.5
                          
                          return (
                            <div className="factor-bar-row" key={f.id}>
                              <div className="factor-label-container">
                                <span style={{ fontWeight: 500 }}>{f.feature_name} ({f.feature_value})</span>
                                <span style={{ 
                                  color: f.direction === 1 ? 'var(--danger)' : 'var(--success)',
                                  fontWeight: 600
                                }}>
                                  {f.direction === 1 ? 'Elevates (+)' : 'Reduces (-)'}
                                </span>
                              </div>
                              <div className="factor-bar-container">
                                <div 
                                  className={`factor-bar ${f.direction === 1 ? 'factor-bar-pos' : 'factor-bar-neg'}`}
                                  style={{ width: `${widthPct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          No specific contributing factors generated.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Risk History Timeline */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 className="chart-title">AI Predictive History Timeline</h3>
            <div className="history-timeline">
              {predictions.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No predictive logs computed yet.
                </div>
              ) : (
                predictions.map((p) => (
                  <div key={p.id} className="timeline-event">
                    <div className={`timeline-event ${p.risk_level === 'HIGH' ? 'timeline-event-high' : ''}`}>
                      <div className="timeline-date">{new Date(p.predicted_at).toLocaleDateString()}</div>
                      <div className="timeline-title" style={{
                        color: p.risk_level === 'HIGH' ? 'var(--danger)' : p.risk_level === 'MEDIUM' ? 'var(--warning)' : 'var(--success)',
                        fontWeight: 600
                      }}>
                        {p.risk_level} Risk - {p.disease}
                      </div>
                      <div className="timeline-desc">
                        Risk Probability: {Math.round(p.probability * 100)}% | Model Version: {p.model_version}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PatientDetails;
