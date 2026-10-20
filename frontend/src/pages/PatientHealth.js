import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { 
  Activity, 
  TrendingUp, 
  Stethoscope, 
  Clock
} from 'lucide-react';
import PatientPortalHeader from '../components/PatientPortalHeader';
import { getLanguage, setLanguage, TRANSLATIONS } from '../utils/patientTranslations';
import { cachePatientData, getCachedPatientData } from '../services/offlineStorage';

const PatientHealth = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lang, setLangState] = useState(getLanguage());
  const [cachedAt, setCachedAt] = useState(null);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [activeMetric, setActiveMetric] = useState('bp'); // 'bp' | 'glucose' | 'weight'

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const userId = user?.id || user?._id;

  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const handleToggleLang = (newLang) => {
    setLanguage(newLang);
    setLangState(newLang);
  };

  const loadHealth = useCallback(async () => {
    try {
      if (!data) setLoading(true);
      else setRefreshing(true);
      setError('');

      const res = await api.patientPortal.getHealth();
      setData(res);
      setIsOffline(false);
      setCachedAt(new Date().toISOString());

      if (userId) {
        cachePatientData(userId, 'health', res);
      }
    } catch (err) {
      console.warn('Network error loading health data, checking cache:', err);
      if (userId) {
        const cached = getCachedPatientData(userId, 'health');
        if (cached && cached.data) {
          setData(cached.data);
          setCachedAt(cached.cachedAt);
          setIsOffline(true);
          return;
        }
      }
      setError(err.message || 'Failed to load health records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, data]);

  useEffect(() => {
    loadHealth();

    const handleOnline = () => {
      setIsOffline(false);
      loadHealth();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadHealth]);

  if (loading && !data) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b', fontSize: '1rem' }}>{t.loading}</p>
      </div>
    );
  }

  const record = data?.latest_visit;
  const trendHistory = data?.trend_history || [];

  // Filter valid data points for trend chart (NEVER plot missing values as zero)
  const chartDataPoints = trendHistory.map((h, i) => {
    const dateStr = h.recorded_at || h.created_at;
    const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' }) : `Visit ${i+1}`;
    
    // Parse valid numeric values, null if missing (DO NOT convert to 0)
    const sys = h.systolic_bp != null ? Number(h.systolic_bp) : (h.blood_pressure_systolic != null ? Number(h.blood_pressure_systolic) : null);
    const dia = h.diastolic_bp != null ? Number(h.diastolic_bp) : (h.blood_pressure_diastolic != null ? Number(h.blood_pressure_diastolic) : null);
    const glu = h.blood_glucose != null ? Number(h.blood_glucose) : (h.blood_sugar_fasting != null ? Number(h.blood_sugar_fasting) : (h.blood_sugar_random != null ? Number(h.blood_sugar_random) : null));
    const wt = h.weight != null && !isNaN(Number(h.weight)) ? Number(h.weight) : null;

    return {
      date: formattedDate,
      fullDate: dateStr ? new Date(dateStr).toLocaleDateString() : '',
      systolic: sys,
      diastolic: dia,
      glucose: glu,
      weight: wt
    };
  });

  // Calculate SVG chart coordinates safely
  const renderTrendChart = () => {
    // Only plot points that have non-null values for the active metric
    const validPoints = chartDataPoints.filter(p => {
      if (activeMetric === 'bp') return p.systolic !== null || p.diastolic !== null;
      if (activeMetric === 'glucose') return p.glucose !== null;
      if (activeMetric === 'weight') return p.weight !== null;
      return false;
    });

    if (validPoints.length < 2) {
      return (
        <div style={{ padding: '36px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', color: '#64748b' }}>
          <TrendingUp size={32} style={{ color: '#cbd5e1', margin: '0 auto 10px' }} />
          <p style={{ margin: 0, fontWeight: 500 }}>{t.noTrendsYet}</p>
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Trend graphs automatically appear once you have two or more recorded visits.</span>
        </div>
      );
    }

    const svgWidth = 700;
    const svgHeight = 220;
    const padding = { top: 25, right: 30, bottom: 35, left: 45 };
    const chartW = svgWidth - padding.left - padding.right;
    const chartH = svgHeight - padding.top - padding.bottom;

    // Determine min and max Y values with safety bounds (non-zero)
    let vals = [];
    if (activeMetric === 'bp') {
      vals = validPoints.flatMap(p => [p.systolic, p.diastolic]).filter(v => v !== null && !isNaN(v));
    } else if (activeMetric === 'glucose') {
      vals = validPoints.map(p => p.glucose).filter(v => v !== null && !isNaN(v));
    } else if (activeMetric === 'weight') {
      vals = validPoints.map(p => p.weight).filter(v => v !== null && !isNaN(v));
    }

    if (vals.length === 0) return null;

    const minVal = Math.max(0, Math.min(...vals) - 10);
    const maxVal = Math.max(...vals) + 10;
    const valRange = maxVal - minVal || 1;

    const getX = (idx) => padding.left + (idx / (validPoints.length - 1)) * chartW;
    const getY = (val) => padding.top + chartH - ((val - minVal) / valRange) * chartH;

    const buildPath = (key) => {
      let path = '';
      let started = false;
      validPoints.forEach((p, idx) => {
        const val = p[key];
        if (val !== null && !isNaN(val)) {
          const x = getX(idx);
          const y = getY(val);
          if (!started) {
            path += `M ${x} ${y}`;
            started = true;
          } else {
            path += ` L ${x} ${y}`;
          }
        }
      });
      return path;
    };

    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', minWidth: '500px', height: 'auto', display: 'block' }}>
          {/* Grid lines */}
          {[0, 0.33, 0.66, 1].map((pct, idx) => {
            const y = padding.top + chartH * pct;
            const labelVal = Math.round(maxVal - pct * valRange);
            return (
              <g key={idx}>
                <line x1={padding.left} y1={y} x2={svgWidth - padding.right} y2={y} stroke="#f1f5f9" strokeWidth="1.5" />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="sans-serif">
                  {labelVal}
                </text>
              </g>
            );
          })}

          {/* Lines & Points for Blood Pressure */}
          {activeMetric === 'bp' && (
            <>
              {/* Systolic Line (Blue) */}
              <path d={buildPath('systolic')} fill="none" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {/* Diastolic Line (Teal) */}
              <path d={buildPath('diastolic')} fill="none" stroke="#0d9488" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

              {/* Data points */}
              {validPoints.map((p, idx) => (
                <g key={idx}>
                  {p.systolic !== null && (
                    <circle cx={getX(idx)} cy={getY(p.systolic)} r="5" fill="#0284c7" stroke="#ffffff" strokeWidth="2">
                      <title>{`Systolic: ${p.systolic} mmHg on ${p.fullDate}`}</title>
                    </circle>
                  )}
                  {p.diastolic !== null && (
                    <circle cx={getX(idx)} cy={getY(p.diastolic)} r="5" fill="#0d9488" stroke="#ffffff" strokeWidth="2">
                      <title>{`Diastolic: ${p.diastolic} mmHg on ${p.fullDate}`}</title>
                    </circle>
                  )}
                </g>
              ))}
            </>
          )}

          {/* Blood Glucose Line (Amber) */}
          {activeMetric === 'glucose' && (
            <>
              <path d={buildPath('glucose')} fill="none" stroke="#d97706" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {validPoints.map((p, idx) => p.glucose !== null && (
                <circle key={idx} cx={getX(idx)} cy={getY(p.glucose)} r="5" fill="#d97706" stroke="#ffffff" strokeWidth="2">
                  <title>{`Glucose: ${p.glucose} mg/dL on ${p.fullDate}`}</title>
                </circle>
              ))}
            </>
          )}

          {/* Weight Line (Emerald) */}
          {activeMetric === 'weight' && (
            <>
              <path d={buildPath('weight')} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {validPoints.map((p, idx) => p.weight !== null && (
                <circle key={idx} cx={getX(idx)} cy={getY(p.weight)} r="5" fill="#059669" stroke="#ffffff" strokeWidth="2">
                  <title>{`Weight: ${p.weight} kg on ${p.fullDate}`}</title>
                </circle>
              ))}
            </>
          )}

          {/* X Axis Labels */}
          {validPoints.map((p, idx) => (
            <text key={idx} x={getX(idx)} y={svgHeight - 10} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="500">
              {p.date}
            </text>
          ))}
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '12px', fontSize: '0.8rem', color: '#64748b' }}>
          {activeMetric === 'bp' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} />
                <span>Systolic BP (mmHg)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#0d9488', display: 'inline-block' }} />
                <span>Diastolic BP (mmHg)</span>
              </div>
            </>
          )}
          {activeMetric === 'glucose' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
              <span>Blood Glucose (mg/dL)</span>
            </div>
          )}
          {activeMetric === 'weight' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
              <span>Body Weight (kg)</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1040px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <PatientPortalHeader
        title={t.myHealth}
        subtitle={t.latestVitalsSnapshot}
        lang={lang}
        onToggleLang={handleToggleLang}
        cachedAt={cachedAt}
        isOffline={isOffline}
        showBack={true}
        onRefresh={loadHealth}
        refreshing={refreshing}
      />

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px' }}>
          {error}
        </div>
      )}

      {!record ? (
        <div style={{ padding: '40px 20px', background: '#ffffff', borderRadius: '16px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
          <Activity size={36} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
          <h3 style={{ color: '#0f172a', fontWeight: 700, margin: '0 0 6px 0' }}>No Records Available Yet</h3>
          <p style={{ margin: 0, fontSize: '0.92rem' }}>{t.noVitalsYet}</p>
        </div>
      ) : (
        <>
          {/* Latest Recorded Vitals Card */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} style={{ color: '#64748b' }} />
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  {t.lastVisit}: {new Date(record.recorded_at || record.created_at).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </h2>
              </div>
              {record.recorded_at && (
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {new Date(record.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            <div style={{ padding: '24px' }}>
              {/* Vitals Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                
                {/* BP */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ display: 'block', fontSize: '0.82rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                    {t.bp}
                  </span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                    {record.systolic_bp || record.blood_pressure_systolic || '--'} / {record.diastolic_bp || record.blood_pressure_diastolic || '--'}
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>mmHg</span>
                  </div>
                </div>

                {/* Pulse */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ display: 'block', fontSize: '0.82rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                    {t.heartRate}
                  </span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                    {record.heart_rate || '--'}
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>bpm</span>
                  </div>
                </div>

                {/* Blood Glucose */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ display: 'block', fontSize: '0.82rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                    {t.glucose}
                  </span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                    {record.blood_glucose || record.blood_sugar_fasting || record.blood_sugar_random || '--'}
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>mg/dL</span>
                  </div>
                </div>

                {/* Temperature */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ display: 'block', fontSize: '0.82rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                    {t.temperature}
                  </span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                    {record.temperature ? `${record.temperature} °F` : '--'}
                  </div>
                </div>

                {/* Weight & Height */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ display: 'block', fontSize: '0.82rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                    {t.weight} / {t.height}
                  </span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    {record.weight ? `${record.weight} kg` : '--'}
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#64748b', marginLeft: '6px' }}>
                      {record.height ? `/ ${record.height} cm` : ''}
                    </span>
                  </div>
                </div>

                {/* BMI */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ display: 'block', fontSize: '0.82rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                    {t.bmi}
                  </span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                    {record.bmi ? (typeof record.bmi === 'number' ? record.bmi.toFixed(1) : record.bmi) : '--'}
                  </div>
                </div>
              </div>

              {/* Symptoms & Clinical Notes */}
              <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
                  {t.symptoms}
                </h3>
                {record.symptoms ? (
                  <p style={{ margin: 0, fontSize: '0.92rem', color: '#334155' }}>
                    {record.symptoms}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
                    {t.noSymptoms}
                  </p>
                )}
              </div>

              {/* Clinician Review Assessment */}
              {record.doctor_notes && (
                <div style={{
                  padding: '20px',
                  borderRadius: '12px',
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Stethoscope size={18} style={{ color: '#16a34a' }} />
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#14532d' }}>
                        {t.doctorNotesTitle}
                      </h4>
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '0.78rem' }}>
                      {record.review_status || 'REVIEWED'}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 6px 0', fontSize: '0.94rem', color: '#166534', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {record.doctor_notes}
                  </p>
                  {record.reviewed_at && (
                    <div style={{ fontSize: '0.78rem', color: '#15803d' }}>
                      Assessed on {new Date(record.reviewed_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Historical Trend Charts Section */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  {t.trendsTitle}
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.86rem', margin: '4px 0 0 0' }}>
                  {t.trendsSubtext}
                </p>
              </div>

              {/* Metric Selector Tabs */}
              <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setActiveMetric('bp')}
                  style={{
                    background: activeMetric === 'bp' ? '#ffffff' : 'transparent',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: activeMetric === 'bp' ? 700 : 500,
                    color: activeMetric === 'bp' ? '#0f172a' : '#64748b',
                    cursor: 'pointer',
                    boxShadow: activeMetric === 'bp' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  Blood Pressure
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMetric('glucose')}
                  style={{
                    background: activeMetric === 'glucose' ? '#ffffff' : 'transparent',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: activeMetric === 'glucose' ? 700 : 500,
                    color: activeMetric === 'glucose' ? '#0f172a' : '#64748b',
                    cursor: 'pointer',
                    boxShadow: activeMetric === 'glucose' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  Blood Glucose
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMetric('weight')}
                  style={{
                    background: activeMetric === 'weight' ? '#ffffff' : 'transparent',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: activeMetric === 'weight' ? 700 : 500,
                    color: activeMetric === 'weight' ? '#0f172a' : '#64748b',
                    cursor: 'pointer',
                    boxShadow: activeMetric === 'weight' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  Weight
                </button>
              </div>
            </div>

            {/* Pure SVG Trend Chart */}
            {renderTrendChart()}
          </div>
        </>
      )}
    </div>
  );
};

export default PatientHealth;
