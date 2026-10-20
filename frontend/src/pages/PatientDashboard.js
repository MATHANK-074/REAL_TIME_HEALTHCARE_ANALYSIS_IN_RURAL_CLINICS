import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { 
  Activity, 
  Calendar, 
  CheckCircle2, 
  Bell, 
  BellOff, 
  Heart, 
  ChevronRight, 
  Stethoscope,
  Clock,
  Sparkles
} from 'lucide-react';
import { checkPushSupport, subscribeUserToPush, unsubscribeUserFromPush, getPushSubscriptionStatus } from '../services/pushNotifications';
import PatientPortalHeader from '../components/PatientPortalHeader';
import { getLanguage, setLanguage, TRANSLATIONS } from '../utils/patientTranslations';
import { cachePatientData, getCachedPatientData } from '../services/offlineStorage';

const PatientDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lang, setLangState] = useState(getLanguage());
  const [cachedAt, setCachedAt] = useState(null);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [pushLoading, setPushLoading] = useState(false);
  
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const userId = user?.id || user?._id;

  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const handleToggleLang = (newLang) => {
    setLanguage(newLang);
    setLangState(newLang);
  };

  const loadDashboard = useCallback(async () => {
    try {
      if (!data) setLoading(true);
      else setRefreshing(true);
      setError('');

      const res = await api.patientPortal.getDashboard();
      setData(res);
      setIsOffline(false);
      setCachedAt(new Date().toISOString());

      // Save to local offline read-only cache
      if (userId) {
        cachePatientData(userId, 'dashboard', res);
      }
    } catch (err) {
      console.warn('Network error loading dashboard, attempting offline cache:', err);
      // Fallback to local offline cache
      if (userId) {
        const cached = getCachedPatientData(userId, 'dashboard');
        if (cached && cached.data) {
          setData(cached.data);
          setCachedAt(cached.cachedAt);
          setIsOffline(true);
          return;
        }
      }
      setError(err.message || 'Failed to load dashboard records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, data]);

  const checkPushStatus = useCallback(async () => {
    if (!checkPushSupport()) {
      setPushSupported(false);
      return;
    }
    const status = await getPushSubscriptionStatus();
    setPushEnabled(status);
  }, []);

  useEffect(() => {
    loadDashboard();
    checkPushStatus();

    const handleOnline = () => {
      setIsOffline(false);
      loadDashboard();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadDashboard, checkPushStatus]);

  const handleTogglePush = async () => {
    try {
      setPushLoading(true);
      if (pushEnabled) {
        await unsubscribeUserFromPush();
        setPushEnabled(false);
      } else {
        await subscribeUserToPush();
        setPushEnabled(true);
      }
    } catch (err) {
      alert(err.message || "Failed to change notification settings");
    } finally {
      setPushLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b', fontSize: '1rem' }}>{t.loading}</p>
      </div>
    );
  }

  const latestRecord = data?.latest_record;
  const predictions = data?.predictions || [];
  const nextFollowup = data?.next_followup_date;

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1040px', margin: '0 auto', width: '100%' }}>
      {/* Header with Bilingual & Offline Support */}
      <PatientPortalHeader
        title={`${t.welcome}, ${user?.name || 'Patient'}`}
        subtitle={t.healthOverview}
        lang={lang}
        onToggleLang={handleToggleLang}
        cachedAt={cachedAt}
        isOffline={isOffline}
        onRefresh={loadDashboard}
        refreshing={refreshing}
      />

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px' }}>
          {error}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        {/* Assessment Status */}
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '10px', color: '#10b981' }}>
              <CheckCircle2 size={22} />
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t.assessmentStatus}
              </span>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                {data?.latest_assessment_status || 'Pending'}
              </div>
            </div>
          </div>
        </div>

        {/* Health Attention */}
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ 
              background: data?.health_attention === 'Follow-up Recommended' ? '#fef2f2' : data?.health_attention === 'Monitor' ? '#fffbeb' : '#f0f9ff', 
              padding: '10px', 
              borderRadius: '10px', 
              color: data?.health_attention === 'Follow-up Recommended' ? '#ef4444' : data?.health_attention === 'Monitor' ? '#d97706' : '#0ea5e9' 
            }}>
              <Activity size={22} />
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t.healthAttention}
              </span>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                {data?.health_attention || t.vitalNormal}
              </div>
            </div>
          </div>
        </div>

        {/* Next Followup */}
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ background: nextFollowup ? '#fef2f2' : '#f8fafc', padding: '10px', borderRadius: '10px', color: nextFollowup ? '#ef4444' : '#64748b' }}>
              <Calendar size={22} />
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t.nextFollowup}
              </span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                {nextFollowup ? new Date(nextFollowup).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'None scheduled'}
              </div>
            </div>
          </div>
          {data?.next_followup_reason && (
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
              {data.next_followup_reason}
            </div>
          )}
        </div>

        {/* Last Visit */}
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', color: '#64748b' }}>
              <Clock size={22} />
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t.lastVisit}
              </span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                {data?.last_visit_date ? new Date(data.last_visit_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'No visits'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Latest Vitals Snapshot Card */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Heart size={22} style={{ color: '#ef4444' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {t.latestVitalsSnapshot}
            </h2>
          </div>
          <button 
            onClick={() => navigate('/patient/health')}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 14px' }}
          >
            <span>{t.myHealth}</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {!latestRecord ? (
          <div style={{ padding: '30px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', color: '#64748b' }}>
            <p style={{ margin: 0 }}>{t.noVitalsYet}</p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              {/* BP */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t.bp}
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                  {latestRecord.systolic_bp || latestRecord.blood_pressure_systolic || '--'} / {latestRecord.diastolic_bp || latestRecord.blood_pressure_diastolic || '--'}
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>mmHg</span>
                </div>
              </div>

              {/* Pulse */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t.heartRate}
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                  {latestRecord.heart_rate || '--'}
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>bpm</span>
                </div>
              </div>

              {/* Glucose */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t.glucose}
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                  {latestRecord.blood_glucose || latestRecord.blood_sugar_fasting || latestRecord.blood_sugar_random || '--'}
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>mg/dL</span>
                </div>
              </div>

              {/* Weight & BMI */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {t.weight} / {t.bmi}
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                  {latestRecord.weight ? `${latestRecord.weight} kg` : '--'}
                  {latestRecord.bmi ? (
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginLeft: '8px' }}>
                      (BMI: {typeof latestRecord.bmi === 'number' ? latestRecord.bmi.toFixed(1) : latestRecord.bmi})
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', justifyContent: 'flex-end' }}>
              <span>{t.measuredOn}: {new Date(latestRecord.recorded_at || latestRecord.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
          </div>
        )}
      </div>

      {/* Doctor's Assessment Card (When reviewed by Clinician) */}
      {latestRecord?.doctor_notes && (
        <div style={{
          background: '#f0fdf4',
          border: '1.5px solid #86efac',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Stethoscope size={22} style={{ color: '#16a34a' }} />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#14532d', margin: 0 }}>
              {t.doctorNotesTitle}
            </h2>
            <span className="badge badge-success" style={{ marginLeft: 'auto', fontSize: '0.78rem' }}>
              {latestRecord.review_status || 'REVIEWED'}
            </span>
          </div>
          <p style={{ margin: '0 0 10px 0', fontSize: '0.96rem', color: '#166534', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {latestRecord.doctor_notes}
          </p>
          {latestRecord.reviewed_at && (
            <div style={{ fontSize: '0.78rem', color: '#15803d' }}>
              Reviewed on: {new Date(latestRecord.reviewed_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>
      )}

      {/* AI Risk Screening Snapshot */}
      {predictions.length > 0 && (
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={20} style={{ color: 'var(--primary, #0284c7)' }} />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {t.aiTitle}
              </h2>
            </div>
            <button
              onClick={() => navigate('/patient/predictions')}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 14px' }}
            >
              <span>View All Assessments</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
            {predictions.map((p, idx) => {
              const rUpper = (p.risk_level || 'LOW').toUpperCase();
              const isHigh = rUpper === 'HIGH';
              const isMed = rUpper === 'MODERATE' || rUpper === 'MEDIUM';
              const badgeClass = isHigh ? 'badge-danger' : isMed ? 'badge-warning' : 'badge-success';
              return (
                <div key={idx} style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>{p.model_name}</span>
                  <span className={`badge ${badgeClass}`} style={{ fontSize: '0.76rem' }}>{rUpper}</span>
                </div>
              );
            })}
          </div>

          <div style={{ background: '#f8fafc', borderLeft: '4px solid #0284c7', padding: '10px 14px', borderRadius: '0 8px 8px 0', fontSize: '0.82rem', color: '#64748b' }}>
            <strong>Notice:</strong> {t.aiAdvisoryBody}
          </div>
        </div>
      )}

      {/* Notification Settings */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>{t.notifications}</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <p style={{ color: '#334155', margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>Browser Push Notifications</p>
            <p style={{ color: '#64748b', fontSize: '0.86rem', marginTop: '4px', marginBottom: 0 }}>
              {!pushSupported 
                ? 'Browser notifications are not supported on this device.' 
                : pushEnabled 
                  ? '✓ Notifications enabled on this browser.' 
                  : 'Receive follow-up and clinical check-in alerts directly on this device.'}
            </p>
          </div>
          {pushSupported && (
            <button 
              onClick={handleTogglePush}
              disabled={pushLoading}
              className={pushEnabled ? "btn btn-secondary" : "btn btn-primary"}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.85rem' }}
            >
              {pushEnabled ? <BellOff size={16} /> : <Bell size={16} />}
              {pushLoading ? 'Updating...' : pushEnabled ? 'Disable notifications' : 'Enable notifications'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientDashboard;
