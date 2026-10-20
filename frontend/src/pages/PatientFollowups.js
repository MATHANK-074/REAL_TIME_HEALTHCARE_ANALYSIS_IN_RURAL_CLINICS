import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Calendar, Stethoscope } from 'lucide-react';
import PatientPortalHeader from '../components/PatientPortalHeader';
import { getLanguage, setLanguage, TRANSLATIONS } from '../utils/patientTranslations';
import { cachePatientData, getCachedPatientData } from '../services/offlineStorage';

const PatientFollowups = () => {
  const [followups, setFollowups] = useState([]);
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

  const loadFollowups = useCallback(async () => {
    try {
      if (followups.length === 0) setLoading(true);
      else setRefreshing(true);
      setError('');

      const res = await api.getFollowups(); 
      setFollowups(Array.isArray(res) ? res : []);
      setIsOffline(false);
      setCachedAt(new Date().toISOString());

      if (userId) {
        cachePatientData(userId, 'followups', res);
      }
    } catch (err) {
      console.warn('Network error loading followups, checking cache:', err);
      if (userId) {
        const cached = getCachedPatientData(userId, 'followups');
        if (cached && cached.data) {
          setFollowups(Array.isArray(cached.data) ? cached.data : []);
          setCachedAt(cached.cachedAt);
          setIsOffline(true);
          return;
        }
      }
      setError(err.message || 'Failed to fetch follow-up appointments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, followups.length]);

  useEffect(() => {
    loadFollowups();

    const handleOnline = () => {
      setIsOffline(false);
      loadFollowups();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadFollowups]);

  if (loading && followups.length === 0) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: '880px', margin: '0 auto', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b' }}>{t.loading}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: '880px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <PatientPortalHeader
        title={t.followups}
        subtitle="Scheduled check-ins and clinical review appointments assigned by your doctor."
        lang={lang}
        onToggleLang={handleToggleLang}
        cachedAt={cachedAt}
        isOffline={isOffline}
        showBack={true}
        onRefresh={loadFollowups}
        refreshing={refreshing}
      />

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px' }}>
          {error}
        </div>
      )}

      {followups.length === 0 ? (
        <div style={{ padding: '40px 20px', background: '#ffffff', borderRadius: '16px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
          <Calendar size={36} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
          <h3 style={{ color: '#0f172a', fontWeight: 700, margin: '0 0 6px 0' }}>{t.noFollowups}</h3>
          <p style={{ margin: 0, fontSize: '0.92rem' }}>You are completely up to date with no scheduled clinical check-ins required.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {followups.map((fup, idx) => {
            const rawStatus = (fup.status || 'PENDING').toUpperCase();
            const isCompleted = rawStatus === 'COMPLETED';
            const priorityUpper = (fup.priority || 'ROUTINE').toUpperCase();
            const isUrgent = priorityUpper === 'URGENT' || priorityUpper === 'CRITICAL';

            const fDate = new Date(fup.followup_date);
            const isToday = new Date().toDateString() === fDate.toDateString();

            return (
              <div 
                key={fup.id || idx} 
                style={{ 
                  background: '#ffffff', 
                  borderRadius: '16px', 
                  border: isUrgent ? '1.5px solid #fecaca' : '1px solid #e2e8f0', 
                  padding: '22px', 
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Calendar size={18} style={{ color: isUrgent ? '#dc2626' : 'var(--primary, #0284c7)' }} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                      {fDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                    </h3>
                    {isToday && (
                      <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>DUE TODAY</span>
                    )}
                  </div>

                  <p style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#334155', fontWeight: 500 }}>
                    <strong>{t.purpose}:</strong> {fup.reason || 'General health evaluation and vitals check'}
                  </p>

                  {fup.doctor_name && (
                    <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Stethoscope size={14} />
                      <span>{t.assignedDoctor}: <strong>{fup.doctor_name}</strong></span>
                    </div>
                  )}

                  {fup.notes && (
                    <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', color: '#475569', border: '1px solid #e2e8f0' }}>
                      <strong>Instructions:</strong> {fup.notes}
                    </div>
                  )}
                </div>

                {/* Status & Priority Badges */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <span style={{ 
                    background: isCompleted ? '#ecfdf5' : isToday ? '#fffbeb' : '#eff6ff', 
                    color: isCompleted ? '#059669' : isToday ? '#d97706' : '#0284c7', 
                    padding: '6px 14px', 
                    borderRadius: '20px', 
                    fontSize: '0.82rem', 
                    fontWeight: 700,
                    border: `1px solid ${isCompleted ? '#a7f3d0' : isToday ? '#fde68a' : '#bae6fd'}`
                  }}>
                    {isCompleted ? t.statusCompleted : t.statusPending}
                  </span>

                  {isUrgent && (
                    <span className="badge badge-danger" style={{ fontSize: '0.74rem' }}>
                      {priorityUpper}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PatientFollowups;
