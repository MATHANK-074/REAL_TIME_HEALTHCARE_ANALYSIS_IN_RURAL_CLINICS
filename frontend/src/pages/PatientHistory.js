import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Calendar, Stethoscope, Sparkles, FileText } from 'lucide-react';
import PatientPortalHeader from '../components/PatientPortalHeader';
import { getLanguage, setLanguage, TRANSLATIONS } from '../utils/patientTranslations';
import { cachePatientData, getCachedPatientData } from '../services/offlineStorage';

const PatientHistory = () => {
  const [history, setHistory] = useState([]);
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

  const loadHistory = useCallback(async () => {
    try {
      if (history.length === 0) setLoading(true);
      else setRefreshing(true);
      setError('');

      const res = await api.patientPortal.getHistory();
      setHistory(Array.isArray(res) ? res : []);
      setIsOffline(false);
      setCachedAt(new Date().toISOString());

      if (userId) {
        cachePatientData(userId, 'history', res);
      }
    } catch (err) {
      console.warn('Network error loading history, checking cache:', err);
      if (userId) {
        const cached = getCachedPatientData(userId, 'history');
        if (cached && cached.data) {
          setHistory(Array.isArray(cached.data) ? cached.data : []);
          setCachedAt(cached.cachedAt);
          setIsOffline(true);
          return;
        }
      }
      setError(err.message || 'Failed to fetch medical history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, history.length]);

  useEffect(() => {
    loadHistory();

    const handleOnline = () => {
      setIsOffline(false);
      loadHistory();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadHistory]);

  if (loading && history.length === 0) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b' }}>{t.loading}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: '880px', margin: '0 auto', width: '100%' }}>
      {/* Header with Bilingual & Offline Support */}
      <PatientPortalHeader
        title={t.history}
        subtitle="Chronological timeline of all your screening visits, vitals, and physician reviews."
        lang={lang}
        onToggleLang={handleToggleLang}
        cachedAt={cachedAt}
        isOffline={isOffline}
        showBack={true}
        onRefresh={loadHistory}
        refreshing={refreshing}
      />

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px' }}>
          {error}
        </div>
      )}

      {history.length === 0 ? (
        <div style={{ padding: '40px 20px', background: '#ffffff', borderRadius: '16px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
          <FileText size={36} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
          <h3 style={{ color: '#0f172a', fontWeight: 700, margin: '0 0 6px 0' }}>No Visit History Found</h3>
          <p style={{ margin: 0, fontSize: '0.92rem' }}>You have no screening visits recorded in your file yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {history.map((item, idx) => {
            const rec = item.record || {};
            const preds = item.predictions || [];
            const visitDate = rec.recorded_at || rec.created_at;

            const sys = rec.systolic_bp != null ? rec.systolic_bp : rec.blood_pressure_systolic;
            const dia = rec.diastolic_bp != null ? rec.diastolic_bp : rec.blood_pressure_diastolic;
            const glucose = rec.blood_glucose != null ? rec.blood_glucose : (rec.blood_sugar_fasting || rec.blood_sugar_random);

            return (
              <div 
                key={rec.id || idx} 
                style={{ 
                  background: '#ffffff', 
                  borderRadius: '16px', 
                  border: '1px solid #e2e8f0', 
                  overflow: 'hidden', 
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)' 
                }}
              >
                {/* Visit Header */}
                <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} style={{ color: 'var(--primary, #0284c7)' }} />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                      {visitDate ? new Date(visitDate).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }) : `Visit ${history.length - idx}`}
                    </h3>
                  </div>
                  {rec.review_status && rec.review_status !== 'PENDING_REVIEW' && (
                    <span className="badge badge-success" style={{ fontSize: '0.74rem' }}>
                      {rec.review_status}
                    </span>
                  )}
                </div>

                <div style={{ padding: '20px' }}>
                  {/* Vitals Summary Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                    
                    {/* BP */}
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        {t.bp}
                      </span>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
                        {sys || '--'} / {dia || '--'} <small style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.75rem' }}>mmHg</small>
                      </div>
                    </div>

                    {/* Pulse */}
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        {t.heartRate}
                      </span>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
                        {rec.heart_rate || '--'} <small style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.75rem' }}>bpm</small>
                      </div>
                    </div>

                    {/* Glucose */}
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        {t.glucose}
                      </span>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
                        {glucose || '--'} <small style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.75rem' }}>mg/dL</small>
                      </div>
                    </div>

                    {/* Weight */}
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        {t.weight}
                      </span>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
                        {rec.weight ? `${rec.weight} kg` : '--'}
                      </div>
                    </div>
                  </div>

                  {/* Symptoms & Clinical Notes */}
                  {(rec.symptoms || rec.clinical_notes) && (
                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '14px', fontSize: '0.88rem' }}>
                      {rec.symptoms && (
                        <div style={{ marginBottom: rec.clinical_notes ? '6px' : '0' }}>
                          <strong style={{ color: '#475569' }}>Symptoms: </strong>
                          <span style={{ color: '#0f172a' }}>{rec.symptoms}</span>
                        </div>
                      )}
                      {rec.clinical_notes && (
                        <div>
                          <strong style={{ color: '#475569' }}>Field Observations: </strong>
                          <span style={{ color: '#0f172a' }}>{rec.clinical_notes}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Clinician's Notes (Cleanly separated from AI predictions) */}
                  {rec.doctor_notes && (
                    <div style={{ padding: '14px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <Stethoscope size={15} style={{ color: '#16a34a' }} />
                        <strong style={{ fontSize: '0.86rem', color: '#14532d' }}>Physician's Assessment:</strong>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#166534', lineHeight: 1.5 }}>
                        {rec.doctor_notes}
                      </p>
                    </div>
                  )}

                  {/* AI Predictions for this Visit */}
                  {preds.length > 0 && (
                    <div style={{ paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <Sparkles size={14} style={{ color: 'var(--primary, #0284c7)' }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                          AI Health Screening Results
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {preds.map((p, pIdx) => {
                          const r = (p.risk_level || 'LOW').toUpperCase();
                          const isH = r === 'HIGH';
                          const isM = r === 'MODERATE' || r === 'MEDIUM';
                          const cls = isH ? 'badge-danger' : isM ? 'badge-warning' : 'badge-success';
                          return (
                            <span key={pIdx} className={`badge ${cls}`} style={{ fontSize: '0.74rem', padding: '3px 8px' }}>
                              {p.model_name}: {r}
                            </span>
                          );
                        })}
                      </div>
                    </div>
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

export default PatientHistory;
