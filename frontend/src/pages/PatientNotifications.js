import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Bell, CheckCheck, Inbox, AlertCircle, Info } from 'lucide-react';
import PatientPortalHeader from '../components/PatientPortalHeader';
import { getLanguage, setLanguage, TRANSLATIONS } from '../utils/patientTranslations';
import { cachePatientData, getCachedPatientData } from '../services/offlineStorage';

const PatientNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lang, setLangState] = useState(getLanguage());
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
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

  const loadNotifications = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const res = await api.getNotifications(0, 50);
      const notifsList = Array.isArray(res) ? res : [];
      setNotifications(notifsList);
      setIsOffline(false);
      setCachedAt(null);

      if (userId) {
        cachePatientData(userId, 'notifications', notifsList);
      }
    } catch (err) {
      console.warn('API error fetching notifications, falling back to cache:', err);
      if (userId) {
        const cached = getCachedPatientData(userId, 'notifications');
        if (cached && cached.data) {
          setNotifications(cached.data);
          setCachedAt(cached.cachedAt);
          setIsOffline(true);
          return;
        }
      }
      setError(err.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadNotifications();

    const handleOnline = () => {
      setIsOffline(false);
      loadNotifications(true);
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadNotifications]);

  const markRead = async (id) => {
    if (isOffline) return; // Read-only in offline mode
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const markAllRead = async () => {
    if (isOffline) return;
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const displayedNotifications = filterUnreadOnly
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading && !refreshing && notifications.length === 0) {
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
        title={t.notifications}
        subtitle={lang === 'ta' ? 'மருத்துவமனை மற்றும் பராமரிப்புக் குழுவின் முக்கிய செய்திகள்' : 'Important updates and alerts from your healthcare providers'}
        lang={lang}
        onToggleLang={handleToggleLang}
        cachedAt={cachedAt}
        isOffline={isOffline}
        showBack={true}
        onRefresh={() => loadNotifications(true)}
        refreshing={refreshing}
      />

      {error && !isOffline && (
        <div className="alert alert-danger" style={{ borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter & Actions Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '12px',
        marginBottom: '20px',
        background: '#ffffff',
        padding: '12px 18px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setFilterUnreadOnly(false)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: !filterUnreadOnly ? 'var(--primary, #0284c7)' : '#f1f5f9',
              color: !filterUnreadOnly ? '#ffffff' : '#64748b',
              transition: 'all 0.15s ease'
            }}
          >
            {t.allNotifications} ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterUnreadOnly(true)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: filterUnreadOnly ? 'var(--primary, #0284c7)' : '#f1f5f9',
              color: filterUnreadOnly ? '#ffffff' : '#64748b',
              transition: 'all 0.15s ease'
            }}
          >
            {t.unreadOnly} {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>

        {unreadCount > 0 && !isOffline && (
          <button
            onClick={markAllRead}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary, #0284c7)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px'
            }}
          >
            <CheckCheck size={16} />
            <span>{t.markAllRead}</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      {displayedNotifications.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1.5px dashed #cbd5e1',
          padding: '45px 20px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <Inbox size={42} style={{ color: '#94a3b8', marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155', margin: '0 0 6px 0' }}>
            {t.noNotifications}
          </h3>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
            {t.noNotificationsSub}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayedNotifications.map((notif, idx) => {
            const isUnread = !notif.is_read;
            const priority = (notif.priority || 'MEDIUM').toUpperCase();
            const isUrgent = priority === 'URGENT' || priority === 'CRITICAL' || priority === 'HIGH';

            return (
              <div 
                key={notif.id || idx}
                onClick={() => isUnread && markRead(notif.id)}
                style={{
                  background: isUnread ? '#f0f9ff' : '#ffffff',
                  borderRadius: '14px',
                  border: isUnread ? '1.5px solid #bae6fd' : '1px solid #e2e8f0',
                  padding: '18px 20px',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                  cursor: isUnread && !isOffline ? 'pointer' : 'default',
                  transition: 'background-color 0.2s ease',
                  boxShadow: isUnread ? '0 2px 8px rgba(14, 165, 233, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: isUrgent ? '#fee2e2' : isUnread ? '#e0f2fe' : '#f1f5f9',
                  color: isUrgent ? '#dc2626' : isUnread ? '#0284c7' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  {isUrgent ? <AlertCircle size={20} /> : <Bell size={20} />}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <h4 style={{ 
                      margin: 0, 
                      fontSize: '1rem', 
                      color: isUnread ? '#0f172a' : '#334155', 
                      fontWeight: isUnread ? 700 : 600 
                    }}>
                      {notif.title}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isUrgent && (
                        <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                          {priority}
                        </span>
                      )}
                      {isUnread && (
                        <span style={{
                          background: '#0ea5e9',
                          color: '#ffffff',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.68rem',
                          fontWeight: 700
                        }}>
                          {t.unread}
                        </span>
                      )}
                    </div>
                  </div>

                  <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
                    {notif.message}
                  </p>

                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={12} />
                    <span>{new Date(notif.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PatientNotifications;
