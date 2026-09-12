import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { 
  Activity, Mail, Lock, Stethoscope, Shield, AlertCircle, Eye, EyeOff, LockKeyhole,
  MapPin, Hospital, FileText, UserCheck, HeartPulse, CheckCircle2, Brain 
} from 'lucide-react';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const loginData = await api.login(email, password);
      
      localStorage.setItem('token', loginData.access_token);
      localStorage.setItem('user', JSON.stringify({
        id: loginData.id,
        email: loginData.email,
        name: loginData.name,
        role: loginData.role,
        area_id: loginData.area_id,
        village_id: loginData.village_id,
        subdistrict_id: loginData.subdistrict_id,
        clinic_id: loginData.clinic_id
      }));
      onLoginSuccess(loginData);
      redirectDashboard(loginData.role);
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
    <div className="login-layout">
      {/* Left Side: Product Identity & Illustration */}
      <div className="login-left">
        <div className="login-left-inner">
          

          
          <div className="login-hero">
            <h1 className="login-headline">
              Smarter Healthcare.<br/>
              Stronger Rural Communities.
            </h1>
            <p className="login-subheadline">
              AI-powered healthcare analytics and clinical decision support connecting district health teams, doctors and frontline health workers.
            </p>
          </div>
          
          <div className="login-visual">
            <div className="login-visual-image-wrapper">
              <img
                src="https://assets.indiaonline.in/cg/tn/About/Health/Tamilnadu-Healthcare.jpg"
                alt="Doctor and patient in rural health setting"
                className="login-hero-image"
                onError={(e) => {
                  e.target.onerror = null; 
                  e.target.src = "https://images.unsplash.com/photo-1526406915899-fcd9e4c2c2d8?auto=format&fit=crop&w=800&q=80"; 
                }}
              />
            </div>
            <div className="login-visual-text">
              <h3>Transforming Rural Healthcare</h3>
              <p>Empowering frontline health workers in Erode District with real-time data and AI-driven clinical insights to deliver better care, faster.</p>
            </div>
          </div>
          
          {/* Feature Strip */}
          <div className="login-features">
            <div className="login-feature">
              <div className="feature-icon feature-icon-blue"><Shield size={18} /></div>
              <h4>SECURE ACCESS</h4>
              <p>Role-based permissions protect patient information.</p>
            </div>
            <div className="login-feature">
              <div className="feature-icon feature-icon-green"><Brain size={18} /></div>
              <h4>PATIENT RISK INSIGHTS</h4>
              <p>AI-assisted screening for diabetes, cardiovascular and maternal health risks.</p>
            </div>
            <div className="login-feature">
              <div className="feature-icon feature-icon-lightblue"><MapPin size={18} /></div>
              <h4>FIELD-TO-CLINIC CARE</h4>
              <p>Connect health workers, clinics and doctors through location-based workflows.</p>
            </div>
          </div>

          <div className="login-footer-left">
            <Shield size={16} className="footer-shield" />
            Built for secure and accessible rural healthcare.
          </div>
        </div>
      </div>
      
      {/* Right Side: Focused Login Card */}
      <div className="login-right">
        <div className="login-form-wrapper">
          <div className="login-form-container">
            <div className="login-form-header">
              <h2 className="login-form-title">Welcome back</h2>
              <p className="login-form-subtitle">Sign in to your RuralCare AI workspace</p>
            </div>
            
            {error && (
              <div className="login-error-alert">
                <AlertCircle size={20} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
            
            <form onSubmit={handleAuth}>
              <div className="login-input-group">
                <label className="login-input-label">Email address</label>
                <div className="login-input-wrapper">
                  <Mail size={18} className="login-input-icon" />
                  <input 
                    type="email" 
                    className="login-input" 
                    placeholder="Enter your registered email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
              </div>
              
              <div className="login-input-group">
                <label className="login-input-label">Password</label>
                <div className="login-input-wrapper">
                  <Lock size={18} className="login-input-icon" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="login-input" 
                    placeholder="Enter your password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                  <button 
                    type="button" 
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="forgot-password">
                  <span title="Please contact your administrator to reset password">
                    Forgot password?
                  </span>
                </div>
              </div>
              
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              
              <div className="login-security-info">
                <LockKeyhole size={14} />
                <span>Role-based permissions protect patient information.</span>
              </div>

              <div className="login-divider"></div>
              
              <div className="login-account-msg">
                Need access?<br />
                Contact your system administrator to request an account.
              </div>
            </form>
          </div>
          
          <div className="login-footer-right">
            Erode District Pilot &bull; Tamil Nadu
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;