import React, { useState, useEffect } from 'react';
import { Bell, ShieldAlert, Check } from 'lucide-react';
import { api } from '../services/api';

const Header = ({ title, user }) => {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchNotifications = async () => {
    try {
      if (!user) return;
      const data = await api.getNotifications();
      // filter unread notifications
      setNotifications(data.filter(n => n.is_read === false));
    } catch (e) {
      console.log('Error fetching notifications', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Poll notifications every 15s
    return () => clearInterval(interval);
  }, [user]);

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.log('Failed to mark read', e);
    }
  };

  return (
    <header className="header-bar">
      <h1 className="header-title">{title}</h1>
      
      <div className="header-actions">
        {/* Notifications Notification System */}
        <div style={{ position: 'relative' }}>
          <button 
            className="btn btn-secondary" 
            style={{ borderRadius: '50%', width: '42px', height: '42px', padding: 0 }}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <Bell size={20} />
            {notifications.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#ef4444',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 0 2px var(--bg-dark)'
              }}>
                {notifications.length}
              </span>
            )}
          </button>

          {showDropdown && (
            <div className="glass" style={{
              position: 'absolute',
              right: 0,
              top: '50px',
              width: '320px',
              maxHeight: '400px',
              overflowY: 'auto',
              zIndex: 100,
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-card)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Recent Notifications</span>
                {notifications.length > 0 && (
                  <span className="badge badge-danger">{notifications.length} New</span>
                )}
              </div>

              {notifications.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No unread notifications
                </div>
              ) : (
                <div className="alerts-list">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className="alert-item alert-item-unread"
                      style={{ fontSize: '0.8rem', padding: '10px' }}
                    >
                      <ShieldAlert size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1 }}>
                        <div className="alert-msg" style={{ fontSize: '0.8rem' }}>{notif.message}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                          <span className="alert-time">{new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          <button 
                            onClick={(e) => handleMarkAsRead(notif.id, e)}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              color: 'var(--success)', 
                              cursor: 'pointer', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '2px', 
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}
                          >
                            <Check size={12} /> Read
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
