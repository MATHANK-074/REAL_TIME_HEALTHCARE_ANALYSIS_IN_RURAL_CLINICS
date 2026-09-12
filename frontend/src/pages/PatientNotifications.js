import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Bell } from 'lucide-react';

const PatientNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.getNotifications(); 
      setNotifications(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading notifications...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', color: '#1e293b' }}>Notifications</h1>
      {error && <div className="badge badge-danger" style={{ marginBottom: '20px', padding: '10px' }}>{error}</div>}
      
      {notifications.length === 0 ? (
        <div style={{ padding: '30px', background: 'white', borderRadius: '8px', textAlign: 'center', color: '#64748b' }}>
          No new notifications.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {notifications.map((notif, idx) => (
            <div key={idx} onClick={() => !notif.is_read && markRead(notif.id)} style={{ background: notif.is_read ? 'white' : '#f0f9ff', borderRadius: '8px', border: '1px solid', borderColor: notif.is_read ? '#e2e8f0' : '#bae6fd', padding: '20px', display: 'flex', gap: '15px', cursor: notif.is_read ? 'default' : 'pointer' }}>
              <Bell style={{ color: notif.is_read ? '#cbd5e1' : '#0ea5e9', flexShrink: 0, marginTop: '2px' }} size={20} />
              <div>
                <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', color: '#334155', fontWeight: notif.is_read ? 500 : 600 }}>{notif.title}</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>{notif.message}</p>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '10px' }}>
                  {new Date(notif.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default PatientNotifications;
