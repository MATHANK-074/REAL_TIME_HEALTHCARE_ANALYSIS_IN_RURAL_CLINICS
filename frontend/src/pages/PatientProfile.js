import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User } from 'lucide-react';

const PatientProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await api.patientPortal.getProfile();
      setProfile(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading profile...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', color: '#1e293b' }}>My Profile</h1>
      {error && <div className="badge badge-danger" style={{ marginBottom: '20px', padding: '10px' }}>{error}</div>}
      
      {profile && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '40px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={40} color="#94a3b8" />
            </div>
            <div>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', color: '#1e293b' }}>{profile.name}</h2>
              <div style={{ color: '#64748b' }}>Patient ID: {profile.patient_code || profile.id}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '30px' }}>
            
            <div>
              <h3 style={{ fontSize: '1rem', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '15px' }}>Demographics</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: '#475569', fontSize: '0.95rem' }}>
                <div><strong>Age:</strong> {profile.age} years</div>
                <div><strong>Gender:</strong> {profile.gender}</div>
                <div><strong>Mobile:</strong> {profile.phone || 'Not provided'}</div>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '15px' }}>Assigned Location</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: '#475569', fontSize: '0.95rem' }}>
                <div><strong>Village:</strong> {profile.village_name || 'Not assigned'}</div>
                <div><strong>Healthcare Area:</strong> {profile.area_name || 'Not assigned'}</div>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '15px' }}>Care Team</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: '#475569', fontSize: '0.95rem' }}>
                <div><strong>Healthcare Facility:</strong> {profile.clinic_name || 'Not assigned'}</div>
                <div><strong>Assigned Doctor:</strong> {profile.doctor_name || 'Not assigned'}</div>
                <div><strong>Assigned Nurse:</strong> {profile.nurse_name || 'Not assigned'}</div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
export default PatientProfile;
