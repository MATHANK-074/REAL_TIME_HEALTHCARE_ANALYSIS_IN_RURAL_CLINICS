import React from 'react';
import { WifiOff, ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TRANSLATIONS } from '../utils/patientTranslations';

export const PatientPortalHeader = ({ 
  title, 
  subtitle, 
  lang, 
  onToggleLang, 
  cachedAt, 
  isOffline,
  showBack = false,
  onRefresh,
  refreshing = false
}) => {
  const navigate = useNavigate();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const formatCachedTime = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString();
    } catch {
      return isoStr;
    }
  };

  return (
    <div style={{ marginBottom: '22px' }}>
      {/* Offline Alert Banner */}
      {isOffline && (
        <div style={{
          background: '#fffbeb',
          border: '1.5px solid #f59e0b',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#92400e',
          fontSize: '0.88rem',
          boxShadow: '0 2px 6px rgba(245, 158, 11, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <WifiOff size={20} style={{ color: '#d97706', flexShrink: 0 }} />
            <div>
              <strong>{t.offlineNotice}</strong>
              <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '2px' }}>
                {t.offlineSubtext} {cachedAt ? `• ${t.lastSynced}: ${formatCachedTime(cachedAt)}` : ''}
              </div>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff' }}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span>{t.refresh}</span>
            </button>
          )}
        </div>
      )}

      {/* Header bar with Language Toggle and Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          {showBack && (
            <button
              onClick={() => navigate('/patient/dashboard')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: 'var(--primary, #0284c7)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '0 0 6px 0',
                marginBottom: '4px'
              }}
            >
              <ArrowLeft size={16} />
              <span>{t.dashboard}</span>
            </button>
          )}
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ color: '#64748b', fontSize: '0.92rem', margin: '4px 0 0 0' }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Action Controls: Refresh & Language Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              title={t.refresh}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                fontSize: '0.82rem',
                borderRadius: '8px',
                background: '#ffffff'
              }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span className="hide-on-mobile">{t.refresh}</span>
            </button>
          )}

          {/* Bilingual Toggle Button (EN / தமிழ்) */}
          <div style={{
            display: 'inline-flex',
            background: '#f1f5f9',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}>
            <button
              type="button"
              onClick={() => onToggleLang('en')}
              style={{
                background: lang === 'en' ? '#ffffff' : 'transparent',
                border: 'none',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: lang === 'en' ? 700 : 500,
                color: lang === 'en' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                boxShadow: lang === 'en' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => onToggleLang('ta')}
              style={{
                background: lang === 'ta' ? '#ffffff' : 'transparent',
                border: 'none',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: lang === 'ta' ? 700 : 500,
                color: lang === 'ta' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                boxShadow: lang === 'ta' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              தமிழ்
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientPortalHeader;
