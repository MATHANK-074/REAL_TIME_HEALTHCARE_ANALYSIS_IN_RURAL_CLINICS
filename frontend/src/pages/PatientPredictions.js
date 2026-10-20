import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { ShieldAlert, Sparkles, CheckCircle, AlertTriangle, AlertCircle, Info, Calendar } from 'lucide-react';
import PatientPortalHeader from '../components/PatientPortalHeader';
import { getLanguage, setLanguage, TRANSLATIONS } from '../utils/patientTranslations';
import { cachePatientData, getCachedPatientData } from '../services/offlineStorage';

const PatientPredictions = () => {
  const [predictions, setPredictions] = useState([]);
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

  const loadPredictions = useCallback(async () => {
    try {
      if (predictions.length === 0) setLoading(true);
      else setRefreshing(true);
      setError('');

      const res = await api.patientPortal.getPredictions();
      setPredictions(Array.isArray(res) ? res : []);
      setIsOffline(false);
      setCachedAt(new Date().toISOString());

      if (userId) {
        cachePatientData(userId, 'predictions', res);
      }
    } catch (err) {
      console.warn('Network error loading predictions, checking cache:', err);
      if (userId) {
        const cached = getCachedPatientData(userId, 'predictions');
        if (cached && cached.data) {
          setPredictions(Array.isArray(cached.data) ? cached.data : []);
          setCachedAt(cached.cachedAt);
          setIsOffline(true);
          return;
        }
      }
      setError(err.message || 'Failed to load AI assessments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, predictions.length]);

  useEffect(() => {
    loadPredictions();

    const handleOnline = () => {
      setIsOffline(false);
      loadPredictions();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadPredictions]);

  if (loading && predictions.length === 0) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: '880px', margin: '0 auto', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b' }}>{t.loading}</p>
      </div>
    );
  }

  // Model Display Name Mapper
  const formatModelName = (name) => {
    const map = {
      'DIABETES': 'Diabetes Screening',
      'HYPERTENSION': 'Hypertension & Cardiovascular',
      'HEART_DISEASE': 'Heart Disease Risk',
      'STROKE': 'Stroke Risk Assessment',
      'KIDNEY': 'Chronic Kidney Disease Risk',
      'MATERNAL': 'Maternal Health Screening'
    };
    return map[name] || name || 'Clinical Assessment';
  };

  return (
    <div style={{ padding: '24px 20px', maxWidth: '880px', margin: '0 auto', width: '100%' }}>
      {/* Header with Bilingual & Offline Support */}
      <PatientPortalHeader
        title={t.aiTitle}
        subtitle="AI clinical screening scores generated from your recorded vitals to support your medical team."
        lang={lang}
        onToggleLang={handleToggleLang}
        cachedAt={cachedAt}
        isOffline={isOffline}
        showBack={true}
        onRefresh={loadPredictions}
        refreshing={refreshing}
      />

      {/* Mandatory Non-Diagnostic Clinical Notice */}
      <div style={{ 
        background: '#f8fafc', 
        border: '1.5px solid #cbd5e1', 
        borderRadius: '14px', 
        padding: '16px 20px', 
        marginBottom: '24px', 
        display: 'flex', 
        gap: '14px', 
        alignItems: 'flex-start',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <ShieldAlert style={{ color: '#0284c7', flexShrink: 0, marginTop: '2px' }} size={24} />
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '0.94rem', fontWeight: 700, color: '#0f172a' }}>
            {t.aiAdvisoryTitle}
          </h4>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
            {t.aiAdvisoryBody}
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px' }}>
          {error}
        </div>
      )}

      {predictions.length === 0 ? (
        <div style={{ padding: '40px 20px', background: '#ffffff', borderRadius: '16px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
          <Sparkles size={36} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
          <h3 style={{ color: '#0f172a', fontWeight: 700, margin: '0 0 6px 0' }}>No AI Assessments Yet</h3>
          <p style={{ margin: 0, fontSize: '0.92rem' }}>Assessments will be calculated automatically when your vital readings are logged by your village nurse.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {predictions.map((pred, idx) => {
            const rawRisk = (pred.risk_level || '').toUpperCase();
            
            // Check for INSUFFICIENT_DATA / UNAVAILABLE
            const isInsufficient = !rawRisk || rawRisk === 'UNAVAILABLE' || rawRisk === 'INSUFFICIENT_DATA';
            const isHigh = rawRisk === 'HIGH';
            const isMed = rawRisk === 'MODERATE' || rawRisk === 'MEDIUM';
            const isLow = rawRisk === 'LOW';

            let riskColor = '#059669'; // Low
            let riskBg = '#ecfdf5';
            let riskBorder = '#a7f3d0';
            let riskLabel = t.riskLow;

            if (isInsufficient) {
              riskColor = '#64748b';
              riskBg = '#f1f5f9';
              riskBorder = '#cbd5e1';
              riskLabel = t.riskInsufficient;
            } else if (isHigh) {
              riskColor = '#dc2626';
              riskBg = '#fef2f2';
              riskBorder = '#fecaca';
              riskLabel = t.riskHigh;
            } else if (isMed) {
              riskColor = '#d97706';
              riskBg = '#fffbeb';
              riskBorder = '#fde68a';
              riskLabel = t.riskMedium;
            }

            const probPct = pred.probability != null && !isNaN(pred.probability) ? Math.round(pred.probability * 100) : null;

            return (
              <div 
                key={pred.id || idx} 
                style={{ 
                  background: '#ffffff', 
                  borderRadius: '16px', 
                  border: '1px solid #e2e8f0', 
                  padding: '22px', 
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: '#0f172a' }}>
                      {formatModelName(pred.model_name)}
                    </h3>
                  </div>

                  {/* Risk Badge */}
                  <div style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    padding: '6px 14px', 
                    borderRadius: '20px', 
                    background: riskBg, 
                    border: `1.5px solid ${riskBorder}`, 
                    color: riskColor, 
                    fontWeight: 700, 
                    fontSize: '0.85rem', 
                    marginBottom: '14px' 
                  }}>
                    {isHigh && <AlertTriangle size={15} />}
                    {isMed && <AlertCircle size={15} />}
                    {isLow && <CheckCircle size={15} />}
                    {isInsufficient && <Info size={15} />}
                    <span>{riskLabel} {probPct !== null ? `(${probPct}%)` : ''}</span>
                  </div>

                  <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.55, margin: '0 0 14px 0' }}>
                    {isInsufficient 
                      ? "Some vital parameters were not recorded during your visit. Complete assessment will run on your next check-in." 
                      : pred.safe_message}
                  </p>

                  {/* Contributing Factors if available */}
                  {pred.factors && pred.factors.length > 0 && (
                    <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.8rem', border: '1px solid #e2e8f0' }}>
                      <strong style={{ color: '#334155', display: 'block', marginBottom: '4px' }}>{t.contributingFactors}:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {pred.factors.map((f, fIdx) => (
                          <span key={fIdx} style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', color: '#475569' }}>
                            {f.factor || f.description}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Assessment Date Footer */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '10px', fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={13} />
                  <span>
                    {t.assessedOn}: {pred.predicted_at ? new Date(pred.predicted_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Latest Visit'}
                  </span>
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
