import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { 
  User, 
  MapPin, 
  Stethoscope, 
  Phone, 
  AlertCircle, 
  Calendar, 
  Droplet, 
  HeartHandshake
} from 'lucide-react';
import PatientPortalHeader from '../components/PatientPortalHeader';
import { getLanguage, setLanguage, TRANSLATIONS } from '../utils/patientTranslations';
import { cachePatientData, getCachedPatientData } from '../services/offlineStorage';

const PatientProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lang, setLangState] = useState(getLanguage());
  const [cachedAt, setCachedAt] = useState(null);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const userId = user?.id || user?._id;

  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const handleToggleLang = (newLang) => {
    setLanguage(newLang);
    setLangState(newLang);
  };

  const loadProfile = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const res = await api.patientPortal.getProfile();
      setProfile(res);
      setIsOffline(false);
      setCachedAt(null);

      if (userId) {
        cachePatientData(userId, 'profile', res);
      }
    } catch (err) {
      console.warn('API error fetching profile, checking cache:', err);
      if (userId) {
        const cached = getCachedPatientData(userId, 'profile');
        if (cached && cached.data) {
          setProfile(cached.data);
          setCachedAt(cached.cachedAt);
          setIsOffline(true);
          return;
        }
      }
      setError(err.message || 'Unable to load profile data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();

    const handleOnline = () => {
      setIsOffline(false);
      loadProfile(true);
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadProfile]);

  if (loading && !refreshing && !profile) {
    return (
      <div style={{ maxWidth: '850px', margin: '0 auto', padding: '30px 20px', textAlign: 'center' }}>
        <div className="spinner-border text-primary" role="status" style={{ width: '2.5rem', height: '2.5rem' }}></div>
        <p style={{ marginTop: '16px', color: '#64748b', fontSize: '0.95rem' }}>{t.loading}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '24px 20px' }}>
      <PatientPortalHeader
        title={t.profile}
        subtitle={lang === 'ta' ? 'உங்கள் பதிவு செய்யப்பட்ட விவரங்கள் மற்றும் மருத்துவக் குழு' : 'Your registered healthcare details and care team assignments'}
        lang={lang}
        onToggleLang={handleToggleLang}
        cachedAt={cachedAt}
        isOffline={isOffline}
        showBack={true}
        onRefresh={() => loadProfile(true)}
        refreshing={refreshing}
      />

      {error && !isOffline && (
        <div className="alert alert-danger" style={{ borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {profile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Main ID Card Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            borderRadius: '18px',
            padding: '24px',
            color: '#ffffff',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap'
          }}>
            <div style={{
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              flexShrink: 0
            }}>
              <User size={40} color="#0284c7" />
            </div>

            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#ffffff' }}>
                  {profile.name}
                </h2>
                <span style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em'
                }}>
                  {profile.patient_code || 'ID: ' + profile.id}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', fontSize: '0.9rem', color: '#e0f2fe', flexWrap: 'wrap' }}>
                <span>{profile.gender} • {profile.age} {lang === 'ta' ? 'வயது' : 'years'}</span>
                {profile.blood_group && (
                  <span>• {t.bloodGroup}: <strong>{profile.blood_group}</strong></span>
                )}
                {profile.created_at && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    • <Calendar size={13} /> {t.registeredOn}: {new Date(profile.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '18px'
          }}>
            
            {/* Demographics Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '22px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                <User size={18} style={{ color: 'var(--primary, #0284c7)' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  {t.demographics}
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.92rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>{t.patientCode}</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{profile.patient_code || profile.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>{t.age}</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{profile.age} {lang === 'ta' ? 'வயது' : 'years'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>{t.gender}</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{profile.gender}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>{t.phone}</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{profile.phone || t.notProvided}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>{t.bloodGroup}</span>
                  <span style={{ fontWeight: 600, color: '#0284c7' }}>
                    <Droplet size={13} style={{ display: 'inline', marginRight: '4px' }} />
                    {profile.blood_group || t.notProvided}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>{t.emergencyContact}</span>
                  <span style={{ fontWeight: 600, color: profile.emergency_contact ? '#dc2626' : '#64748b' }}>
                    <Phone size={13} style={{ display: 'inline', marginRight: '4px' }} />
                    {profile.emergency_contact || t.notProvided}
                  </span>
                </div>
              </div>
            </div>

            {/* Location & Address Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '22px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                <MapPin size={18} style={{ color: 'var(--primary, #0284c7)' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  {t.assignedLocation}
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.92rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>{t.village}</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{profile.village_name || t.notProvided}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>{t.area}</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{profile.area_name || t.notProvided}</span>
                </div>
                <div style={{ marginTop: '4px' }}>
                  <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '4px' }}>{t.address}</div>
                  <div style={{ fontWeight: 500, color: '#1e293b', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {profile.address || t.notProvided}
                  </div>
                </div>
              </div>
            </div>

            {/* Clinical Care Team Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '22px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                <Stethoscope size={18} style={{ color: 'var(--primary, #0284c7)' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  {t.careTeam}
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.92rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>{t.facility}</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{profile.clinic_name || 'Primary Health Center'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>{t.assignedDoctor}</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{profile.doctor_name || t.notProvided}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>{t.assignedNurse}</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{profile.nurse_name || t.notProvided}</span>
                </div>
              </div>
            </div>

            {/* Health Background Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '22px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                <HeartHandshake size={18} style={{ color: 'var(--primary, #0284c7)' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  {lang === 'ta' ? 'உடல்நலப் பின்னணி' : 'Medical Profile'}
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.92rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>{t.medicalConditions}</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{profile.existing_disease || 'None recorded'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>{t.knownAllergies}</span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{profile.allergies || 'None recorded'}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default PatientProfile;
