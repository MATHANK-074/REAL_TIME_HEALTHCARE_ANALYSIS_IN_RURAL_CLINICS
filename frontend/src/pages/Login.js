import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Activity, Mail, Lock, User, Phone, CheckCircle, UserCheck } from 'lucide-react';

const Login = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [clinics, setClinics] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [areas, setAreas] = useState([]);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('NURSE');
  const [areaId, setAreaId] = useState('');

  useEffect(() => {
    if (isRegistering) {
      const loadMetadata = async () => {
        try {
          const clinicsData = await api.getClinicsMetadata();
          setClinics(clinicsData);
          if (clinicsData.length > 0) {
            setSelectedClinicId(clinicsData[0].id);
            setAreas(clinicsData[0].areas || []);
            if (clinicsData[0].areas && clinicsData[0].areas.length > 0) {
              setAreaId(clinicsData[0].areas[0].id);
            }
          }
        } catch (e) {
          console.error("Failed to load metadata", e);
        }
      };
      loadMetadata();
    }
  }, [isRegistering]);

  const handleClinicChange = (e) => {
    const cid = e.target.value;
    setSelectedClinicId(cid);
    const selected = clinics.find(c => c.id === cid);
    if (selected) {
      setAreas(selected.areas || []);
      if (selected.areas && selected.areas.length > 0) {
        setAreaId(selected.areas[0].id);
      } else {
        setAreaId('');
      }
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isRegistering) {
        const payloadClinic = selectedClinicId ? selectedClinicId : null;
        const payloadArea = (role === 'NURSE' && areaId) ? areaId : null;
        
        await api.register(
          name, 
          email, 
          password, 
          role, 
          phone || null, 
          payloadClinic, 
          payloadArea
        );
        
        // Log in automatically after registration
        const loginData = await api.login(email, password);
        localStorage.setItem('token', loginData.access_token);
        localStorage.setItem('user', JSON.stringify({
          email: loginData.email,
          name: loginData.name,
          role: loginData.role
        }));
        onLoginSuccess(loginData);
        redirectDashboard(loginData.role);
      } else {
        const loginData = await api.login(email, password);
        localStorage.setItem('token', loginData.access_token);
        localStorage.setItem('user', JSON.stringify({
          email: loginData.email,
          name: loginData.name,
          role: loginData.role
        }));
        onLoginSuccess(loginData);
        redirectDashboard(loginData.role);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const redirectDashboard = (userRole) => {
    if (userRole === 'ADMIN') navigate('/admin');
    else if (userRole === 'DOCTOR') navigate('/doctor');
    else if (userRole === 'NURSE') navigate('/nurse');
    else navigate('/');
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass">
        <div className="auth-header">
          <Activity size={48} style={{ color: '#0ea5e9', margin: '0 auto 10px' }} />
          <h2 className="auth-title">RuralCare AI Platform</h2>
          <p className="auth-subtitle">
            {isRegistering ? 'Create clinic provider account' : 'Sign in to access patient records'}
          </p>
        </div>

        {error && (
          <div className="badge badge-danger" style={{ 
            display: 'block', 
            padding: '12px', 
            borderRadius: '10px', 
            marginBottom: '20px', 
            textTransform: 'none', 
            width: '100%', 
            textAlign: 'center' 
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth}>
          {isRegistering && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ paddingLeft: '44px' }}
                  placeholder="Dr. Rajesh Kumar" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  required 
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
              <input 
                type="email" 
                className="form-control" 
                style={{ paddingLeft: '44px' }}
                placeholder="provider@clinic.org" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
              <input 
                type="password" 
                className="form-control" 
                style={{ paddingLeft: '44px' }}
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>
          </div>

          {isRegistering && (
            <>
              <div className="form-group">
                <label className="form-label">Phone Number (Optional)</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                  <input 
                    type="tel" 
                    className="form-control" 
                    style={{ paddingLeft: '44px' }}
                    placeholder="+91 XXXXX XXXXX" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Role</label>
                <div style={{ display: 'flex', gap: '15px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="NURSE" 
                      checked={role === 'NURSE'} 
                      onChange={() => setRole('NURSE')} 
                    />
                    <span>Nurse</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="role" 
                      value="DOCTOR" 
                      checked={role === 'DOCTOR'} 
                      onChange={() => setRole('DOCTOR')} 
                    />
                    <span>Doctor</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Clinic</label>
                <select 
                  className="form-control" 
                  value={selectedClinicId} 
                  onChange={handleClinicChange}
                >
                  {clinics.map(c => (
                    <option key={c.id} value={c.id}>{c.clinic_name}</option>
                  ))}
                </select>
              </div>

              {role === 'NURSE' && areas.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Assigned Area</label>
                  <select 
                    className="form-control" 
                    value={areaId} 
                    onChange={(e) => setAreaId(e.target.value)}
                  >
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '14px', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : isRegistering ? 'Register Account' : 'Login'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            If you need an account, please contact the System Administrator.
          </span>
        </div>
      </div>
    </div>
  );
};

export default Login;
