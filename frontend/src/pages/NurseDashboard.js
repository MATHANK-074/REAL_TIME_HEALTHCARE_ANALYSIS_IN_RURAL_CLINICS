import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { 
  Search, 
  UserPlus, 
  Heart, 
  Activity, 
  CheckCircle,
  User,
  Navigation,
  Calendar,
  FileText,
  MapPin
} from 'lucide-react';
import FieldVisitModal from '../components/FieldVisitModal';

// Helper for vital ranges
const getVitalStatus = (name, value) => {
  if (!value) return null;
  const val = parseFloat(value);
  if (isNaN(val)) return null;

  switch (name) {
    case 'systolic':
      if (val > 180) return { status: 'danger', msg: 'Critical High!' };
      if (val > 140) return { status: 'warning', msg: 'High' };
      if (val < 90) return { status: 'warning', msg: 'Low' };
      return { status: 'success', msg: 'Normal' };
    case 'diastolic':
      if (val > 120) return { status: 'danger', msg: 'Critical High!' };
      if (val > 90) return { status: 'warning', msg: 'High' };
      if (val < 60) return { status: 'warning', msg: 'Low' };
      return { status: 'success', msg: 'Normal' };
    case 'heartRate':
      if (val > 120 || val < 50) return { status: 'danger', msg: 'Abnormal' };
      if (val > 100 || val < 60) return { status: 'warning', msg: 'Slightly Abnormal' };
      return { status: 'success', msg: 'Normal' };
    case 'glucose':
      if (val > 250 || val < 50) return { status: 'danger', msg: 'Critical!' };
      if (val > 140 || val < 70) return { status: 'warning', msg: 'Out of Range' };
      return { status: 'success', msg: 'Normal' };
    case 'temp':
      if (val > 103 || val < 95) return { status: 'danger', msg: 'Critical!' };
      if (val > 100.4 || val < 97) return { status: 'warning', msg: 'Out of Range' };
      return { status: 'success', msg: 'Normal' };
    default:
      return null;
  }
};

const renderVitalInput = (label, name, value, setter, type="number", step="1", required=false, placeholder="") => {
  const statusInfo = getVitalStatus(name, value);
  const borderColor = statusInfo 
    ? statusInfo.status === 'danger' ? '#ef4444' 
      : statusInfo.status === 'warning' ? '#f59e0b' 
      : '#10b981'
    : 'var(--border-color)';
    
  return (
    <div className="form-group">
      <label className="form-label">
        {label}
        {statusInfo && (
          <span style={{ 
            marginLeft: '8px', 
            fontSize: '0.75rem', 
            color: borderColor,
            fontWeight: 'bold'
          }}>
            • {statusInfo.msg}
          </span>
        )}
      </label>
      <input 
        type={type} 
        step={step} 
        className="form-control" 
        value={value} 
        onChange={(e) => setter(e.target.value)} 
        required={required}
        placeholder={placeholder}
        style={{ borderColor: borderColor, transition: 'border-color 0.3s ease', borderWidth: statusInfo ? '2px' : '1px' }}
      />
    </div>
  );
};

const NurseDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modals visibility state
  const [showRegModal, setShowRegModal] = useState(false);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [showFieldVisitModal, setShowFieldVisitModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [registeredPatient, setRegisteredPatient] = useState(null);
  
  // Field Visit State
  const [fieldVisits, setFieldVisits] = useState([]);

  const [predictionResults, setPredictionResults] = useState(null);

  // Followups State
  const [followups, setFollowups] = useState([]);

  // New Patient Form State
  const [regName, setRegName] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regGender, setRegGender] = useState('Male');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regBlood, setRegBlood] = useState('O+');
  const [regEmergency, setRegEmergency] = useState('');
  const [regDisease, setRegDisease] = useState('None');
  const [regAllergies, setRegAllergies] = useState('None');
  const [regVillageId, setRegVillageId] = useState('');
  const [villages, setVillages] = useState([]);
  const [isRegistering, setIsRegistering] = useState(false);

  // Vitals Form State
  const [vWeight, setVWeight] = useState('');
  const [vHeight, setVHeight] = useState('');
  const [vSystolic, setVSystolic] = useState('');
  const [vDiastolic, setVDiastolic] = useState('');
  const [vHeartRate, setVHeartRate] = useState('');
  const [vTemp, setVTemp] = useState('');
  const [vGlucose, setVGlucose] = useState('');
  const [vCholesterol, setVCholesterol] = useState('');
  const [vInsulin, setVInsulin] = useState('');
  const [vPregnancies, setVPregnancies] = useState('0');
  const [vSmoking, setVSmoking] = useState('NEVER');
  const [vSymptoms, setVSymptoms] = useState('');
  const [vNotes, setVNotes] = useState('');
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitalsError, setVitalsError] = useState('');

  // Load patients list
  const loadPatients = useCallback(async () => {
    try {
      const data = await api.getPatients(searchQuery);
      setPatients(data);
    } catch (e) {
      setError('Failed to fetch patients: ' + (e.message || e));
      console.error('Failed to fetch patients', e);
    }
  }, [searchQuery]);

  const [profile, setProfile] = useState(user || null);

  const loadUserProfile = useCallback(async () => {
    try {
      const me = await api.getMe();
      if (me) {
        setProfile(me);
        if (me.village_id) {
          setRegVillageId(me.village_id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch user profile', e);
    }
  }, []);

  const loadVillages = useCallback(async () => {
    try {
      const data = await api.getVillages();
      setVillages(data);
    } catch (e) {
      console.error('Failed to fetch villages', e);
    }
  }, []);

  const loadFieldVisits = useCallback(async () => {
    try {
      const data = await api.getFieldVisits();
      setFieldVisits(data);
    } catch (e) {
      console.error('Failed to fetch field visits', e);
    }
  }, []);

  const loadFollowups = useCallback(async () => {
    try {
      const data = await api.getFollowups();
      const activeFollowups = data.filter(f => f.status !== 'COMPLETED' && f.status !== 'CANCELLED');
      setFollowups(activeFollowups);
    } catch (e) {
      console.error('Failed to fetch followups', e);
    }
  }, []);

  // Helper to reset vitals form
  const resetVitals = () => {
    setVWeight('');
    setVHeight('');
    setVSystolic('');
    setVDiastolic('');
    setVHeartRate('');
    setVTemp('');
    setVGlucose('');
    setVCholesterol('');
    setVInsulin('');
    setVPregnancies('0');
    setVSmoking('NEVER');
    setVSymptoms('');
    setVNotes('');
  };

  // Initial load on mount
  useEffect(() => {
    loadUserProfile();
    loadVillages();
    loadFieldVisits();
    loadFollowups();
  }, [loadUserProfile, loadVillages, loadFieldVisits, loadFollowups]);

  // Load patients when search query changes
  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsRegistering(true);

    const activeVillage = regVillageId || profile?.village_id || user?.village_id;

    try {
      // Village is strictly fixed to the nurse's assigned village
      const newPatient = await api.createPatient({
        name: regName,
        age: parseInt(regAge),
        gender: regGender,
        phone: regPhone || null,
        address: regAddress || null,
        blood_group: regBlood || null,
        emergency_contact: regEmergency || null,
        existing_disease: regDisease || null,
        allergies: regAllergies || null,
        village_id: activeVillage || null
      });
      
      const pEmail = `${newPatient.patient_code.toLowerCase()}@ruralcare.com`;
      const pPass = regPhone || 'password123';
      
      setRegisteredPatient({
        ...newPatient,
        email: pEmail,
        password: pPass
      });
      setShowRegModal(false);
      loadPatients();
      
      // Clear forms
      setRegName('');
      setRegAge('');
      setRegPhone('');
      setRegAddress('');
      setRegEmergency('');
      setRegVillageId(activeVillage || profile?.village_id || user?.village_id || '');
    } catch (err) {
      setError(err.message || 'Failed to register patient.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleOpenVitals = (patient) => {
    setSelectedPatient(patient);
    setPredictionResults(null);
    setVitalsError('');
    setSavingVitals(false);
    setShowVitalsModal(true);
    resetVitals();
  };

  const handleOpenFieldVisit = (patient) => {
    setSelectedPatient(patient);
    setShowFieldVisitModal(true);
  };

  const handleLogVitals = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setVitalsError('');
    setSavingVitals(true);
    try {
      const patientId = selectedPatient?.id || selectedPatient?._id;
      if (!patientId) {
        throw new Error('Invalid patient selection.');
      }

      const parseNum = (val, isFloat = false) => {
        if (val === '' || val === null || val === undefined) return null;
        const parsed = isFloat ? parseFloat(val) : parseInt(val, 10);
        return isNaN(parsed) ? null : parsed;
      };

      const pregVal = parseNum(vPregnancies);

      // Log health record
      await api.logVitals({
        patient_id: String(patientId),
        weight: parseNum(vWeight, true),
        height: parseNum(vHeight, true),
        systolic_bp: parseNum(vSystolic),
        diastolic_bp: parseNum(vDiastolic),
        heart_rate: parseNum(vHeartRate),
        temperature: parseNum(vTemp, true),
        blood_glucose: parseNum(vGlucose),
        cholesterol: parseNum(vCholesterol),
        insulin: parseNum(vInsulin),
        pregnancies: pregVal !== null ? pregVal : 0,
        smoking_status: vSmoking || 'NEVER',
        symptoms: vSymptoms ? vSymptoms.trim() : null,
        clinical_notes: vNotes ? vNotes.trim() : null
      });
      
      setSuccess('Health record vitals logged successfully!');
      setShowVitalsModal(false);
      resetVitals();
      loadPatients();
    } catch (err) {
      const msg = err.message || 'Failed to log health vitals.';
      setVitalsError(msg);
      setError(msg);
    } finally {
      setSavingVitals(false);
    }
  };


  const handleCompleteFollowup = async (id) => {
    try {
      await api.updateFollowupStatus(id, 'COMPLETED');
      setSuccess('Follow-up marked as completed!');
      loadFollowups();
    } catch (e) {
      setError(e.message || 'Failed to complete follow-up');
    }
  };

  return (
    <div className="main-content">
      <div className="header-bar">
        <div>
          <h1 className="header-title">Nurse Vitals Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Registered patients and vital logs check-in
          </p>
        </div>
        
        <button className="btn btn-primary" onClick={() => {
          setError('');
          setSuccess('');
          setShowRegModal(true);
        }}>
          <UserPlus size={18} />
          <span>Register Patient</span>
        </button>
      </div>

      {success && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '12px',
          marginBottom: '20px',
          color: '#15803d',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={20} color="#16a34a" />
            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{success}</span>
          </div>
          <button 
            onClick={() => setSuccess('')} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer', 
              color: '#15803d', 
              fontWeight: 700, 
              fontSize: '1.1rem',
              padding: '0 8px' 
            }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="badge badge-danger" style={{ display: 'block', padding: '14px', width: '100%', marginBottom: '20px', borderRadius: '12px', textTransform: 'none', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Field Visit Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '25px' }}>
        <div className="glass" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '15px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px' }}>
            <Navigation size={24} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{fieldVisits.filter(v => new Date(v.created_at).toDateString() === new Date().toDateString()).length}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Today's Visits</p>
          </div>
        </div>
        <div className="glass" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '15px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}>
            <CheckCircle size={24} style={{ color: '#10b981' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{fieldVisits.filter(v => v.status === 'COMPLETED').length}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Completed</p>
          </div>
        </div>
        <div className="glass" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ padding: '15px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px' }}>
            <Activity size={24} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{fieldVisits.filter(v => v.status === 'STARTED').length}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Pending</p>
          </div>
        </div>
      </div>

      {/* Follow-ups Section */}
      <div className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar color="var(--secondary)" />
            <h3 className="chart-title" style={{ margin: 0 }}>My Area Follow-ups</h3>
          </div>
        </div>
        
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient ID</th>
                <th>Priority</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {followups.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                    No pending follow-ups in your area.
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
                    <td>{fu.reason || '-'}</td>
                    <td>{fu.status}</td>
                    <td>
                      {fu.status !== 'COMPLETED' && (
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => handleCompleteFollowup(fu.id)}
                        >
                          Complete <CheckCircle size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass" style={{ padding: '16px 20px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <Search size={20} style={{ color: 'var(--text-secondary)' }} />
        <input 
          type="text" 
          placeholder="Search patients by name, mobile, or code..." 
          className="form-control"
          style={{ border: 'none', background: 'transparent', padding: '5px' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Patients Table */}
      <div className="glass table-container" style={{ padding: '15px' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient Code</th>
              <th>Name</th>
              <th>Age / Gender</th>
              <th>Phone</th>
              <th>Village</th>
              <th>Last Risk Level</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No patients found in your area. Use Register button to add one.
                </td>
              </tr>
            ) : (
              patients.map((p) => {
                const latestPred = p.predictions && p.predictions.length > 0 ? p.predictions[0] : null;
                const riskClass = latestPred 
                  ? latestPred.risk_level === 'HIGH' ? 'badge-danger' 
                    : latestPred.risk_level === 'MEDIUM' ? 'badge-warning' 
                    : 'badge-success'
                  : 'badge-info';
                
                return (
                  <tr key={p.id}>
                    <td>
                      <span 
                        style={{ color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => navigate(`/patients/${p.id || p._id}`)}
                        title="Click to view full health history & trends"
                      >
                        {p.patient_code}
                      </span>
                    </td>
                    <td>
                      <div 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        onClick={() => navigate(`/patients/${p.id || p._id}`)}
                        title="Click to view patient profile & history"
                      >
                        <User size={16} style={{ color: 'var(--text-secondary)' }} />
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</span>
                      </div>
                    </td>
                    <td>{p.age} years / {p.gender}</td>
                    <td>{p.phone || 'N/A'}</td>
                    <td>{typeof p.village === 'object' ? (p.village?.name || 'N/A') : (p.village || p.village_name || 'N/A')}</td>
                    <td>
                      <span className={`badge ${riskClass}`}>
                        {latestPred ? `${latestPred.risk_level} (${Math.round(latestPred.probability * 100)}%)` : 'NO DATA'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                          onClick={() => navigate(`/patients/${p.id || p._id}`)}
                          title="View clinical history and trends"
                        >
                          <FileText size={14} style={{ color: 'var(--primary)' }} /> History
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                          onClick={() => handleOpenVitals(p)}
                        >
                          <Heart size={14} style={{ color: '#ef4444' }} /> Log Vitals
                        </button>
                        <button 
                          className="btn btn-primary btn-sm"
                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                          onClick={() => handleOpenFieldVisit(p)}
                        >
                          <Navigation size={14} /> Start Visit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: REGISTER PATIENT */}
      {showRegModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="glass" style={{ width: '100%', maxWidth: '640px', padding: '30px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Register New Patient</h2>
              <button className="btn btn-secondary" onClick={() => setShowRegModal(false)}>Cancel</button>
            </div>
            
            {error && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '0.88rem'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleRegisterPatient}>
              <div className="form-group">
                <label className="form-label">Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" className="form-control" required value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Patient's full name" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Age <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="number" className="form-control" required value={regAge} onChange={(e) => setRegAge(e.target.value)} placeholder="Age in years" />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-control" value={regGender} onChange={(e) => setRegGender(e.target.value)}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Mobile Number</label>
                  <input type="tel" className="form-control" placeholder="10-digit number" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select className="form-control" value={regBlood} onChange={(e) => setRegBlood(e.target.value)}>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Full Address</label>
                <textarea className="form-control" rows="2" value={regAddress} onChange={(e) => setRegAddress(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Emergency Contact Number</label>
                <input type="tel" className="form-control" value={regEmergency} onChange={(e) => setRegEmergency(e.target.value)} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Existing Chronic Diseases</label>
                  <input type="text" className="form-control" placeholder="None, Hypertension, Asthma..." value={regDisease} onChange={(e) => setRegDisease(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Allergies</label>
                  <input type="text" className="form-control" placeholder="None, Penicillin, Dust..." value={regAllergies} onChange={(e) => setRegAllergies(e.target.value)} />
                </div>
              </div>

              {/* Village Assignment (Fixed to Nurse's Assigned Village) */}
              <div className="form-group" style={{ marginTop: '14px' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600 }}>
                  <MapPin size={16} color="var(--primary)" /> Assigned Village Jurisdiction <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 700 }}>(Fixed Jurisdiction)</span>
                </label>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                  <strong style={{ color: '#166534', fontSize: '1rem' }}>
                    {villages.find(v => String(v.id) === String(profile?.village_id || user?.village_id))?.name || user?.village_name || profile?.village_name || 'Perundurai East'}
                  </strong>
                  <span className="badge badge-success" style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
                    ASSIGNED
                  </span>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '12px', marginTop: '15px' }}
                disabled={isRegistering}
              >
                {isRegistering ? 'Creating Profile...' : 'Create Patient Profile'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRATION SUCCESS DIALOG */}
      {registeredPatient && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1100, padding: '20px'
        }}>
          <div className="glass" style={{
            width: '100%', maxWidth: '520px', padding: '32px', textAlign: 'center',
            borderRadius: '16px', background: '#ffffff', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: '#dcfce7', color: '#16a34a', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
            }}>
              <CheckCircle size={36} />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
              Patient Profile Created!
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '24px' }}>
              <strong style={{ color: 'var(--primary)' }}>{registeredPatient.name}</strong> has been registered with ID <strong style={{ color: '#0ea5e9' }}>{registeredPatient.patient_code}</strong>.
            </p>

            {/* Credentials Card */}
            <div style={{
              background: '#f8fafc',
              border: '1.5px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '16px 20px',
              textAlign: 'left',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '10px' }}>
                Patient Portal Credentials
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '0.88rem' }}>Username / Email:</span>
                <strong style={{ color: '#1e293b', fontSize: '0.9rem', fontFamily: 'monospace' }}>{registeredPatient.email}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '0.88rem' }}>Default Password:</span>
                <strong style={{ color: '#1e293b', fontSize: '0.9rem', fontFamily: 'monospace' }}>{registeredPatient.password}</strong>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '12px' }}
                onClick={() => setRegisteredPatient(null)}
              >
                Close
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, padding: '12px' }}
                onClick={() => {
                  const p = registeredPatient;
                  setRegisteredPatient(null);
                  handleOpenVitals(p);
                }}
              >
                <Heart size={16} /> Log Vitals Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: LOG VITALS AND VIEW PREDICTION */}
      {showVitalsModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="glass" style={{ width: '100%', maxWidth: '850px', padding: '30px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                Log Vitals: <span style={{ color: 'var(--primary)' }}>{selectedPatient?.name} ({selectedPatient?.patient_code})</span>
              </h2>
              <button className="btn btn-secondary" onClick={() => setShowVitalsModal(false)}>Close</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: predictionResults ? '1fr 1fr' : '1fr', gap: '30px' }}>
              
              {/* Form Side */}
              <div>
                {vitalsError && (
                  <div className="alert alert-danger" style={{ marginBottom: '15px', padding: '10px 15px', borderRadius: '8px', fontSize: '0.9rem' }}>
                    {vitalsError}
                  </div>
                )}
                <form onSubmit={handleLogVitals}>
                  <div className="form-row">
                    {renderVitalInput("Weight (kg)", "weight", vWeight, setVWeight, "number", "0.1", true)}
                    {renderVitalInput("Height (cm)", "height", vHeight, setVHeight, "number", "1", true)}
                  </div>

                  <div className="form-row">
                    {renderVitalInput("Systolic BP (mmHg)", "systolic", vSystolic, setVSystolic, "number", "1", true)}
                    {renderVitalInput("Diastolic BP (mmHg)", "diastolic", vDiastolic, setVDiastolic, "number", "1", true)}
                  </div>

                  <div className="form-row">
                    {renderVitalInput("Heart Rate (bpm)", "heartRate", vHeartRate, setVHeartRate, "number", "1", true)}
                    {renderVitalInput("Temperature (°F)", "temp", vTemp, setVTemp, "number", "0.1", true, "98.6")}
                  </div>

                  <div className="form-row">
                    {renderVitalInput("Blood Glucose (mg/dL)", "glucose", vGlucose, setVGlucose, "number", "1", true)}
                    {renderVitalInput("Cholesterol (mg/dL)", "cholesterol", vCholesterol, setVCholesterol, "number", "1", false)}
                  </div>

                  <div className="form-row">
                    {renderVitalInput("Insulin Level (Optional)", "insulin", vInsulin, setVInsulin, "number", "1", false)}
                    <div className="form-group">
                      <label className="form-label">Smoking Status</label>
                      <select className="form-control" value={vSmoking} onChange={(e) => setVSmoking(e.target.value)}>
                        <option value="NEVER">Never Smoked</option>
                        <option value="FORMER">Former Smoker</option>
                        <option value="CURRENT">Current Smoker</option>
                      </select>
                    </div>
                  </div>

                  {selectedPatient?.gender === 'Female' && (
                    <div className="form-group">
                      <label className="form-label">Number of Pregnancies</label>
                      <input type="number" className="form-control" value={vPregnancies} onChange={(e) => setVPregnancies(e.target.value)} />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Symptoms (Optional)</label>
                    <textarea className="form-control" rows="2" placeholder="Fever, cough, dizziness..." value={vSymptoms} onChange={(e) => setVSymptoms(e.target.value)} />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Clinical Notes (Optional)</label>
                    <textarea className="form-control" rows="2" placeholder="Additional observations..." value={vNotes} onChange={(e) => setVNotes(e.target.value)} />
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={savingVitals}
                    style={{ width: '100%', padding: '12px', marginTop: '15px', fontWeight: 600 }}
                  >
                    {savingVitals ? 'Saving Health Record...' : 'Save Health Record'}
                  </button>
                </form>
              </div>


            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: FIELD VISIT GPS */}
      {showFieldVisitModal && selectedPatient && (
        <FieldVisitModal
          patient={selectedPatient}
          user={user}
          onClose={() => setShowFieldVisitModal(false)}
          onComplete={() => {
            setShowFieldVisitModal(false);
            loadFieldVisits();
            setSuccess(`Field visit for ${selectedPatient.name} completed successfully!`);
          }}
        />
      )}
    </div>
  );
};

export default NurseDashboard;
