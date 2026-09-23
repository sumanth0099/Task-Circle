import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import StatusBlock from '../components/StatusBlock';

export default function NotificationsPage({ refreshUnread }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/notifications');
      setNotifications(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const readOne = async (id) => {
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
      await load();
      if (refreshUnread) refreshUnread();
    } catch (err) {
      console.error('Failed to mark notification as read:', err.message);
    }
  };

  const readAll = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'PATCH' });
      await load();
      if (refreshUnread) refreshUnread();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err.message);
    }
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="section-heading" style={{ marginBottom: 0 }}>
          <span className="card-title-icon">🔔</span> Notifications
        </div>
        {notifications.some(n => !n.is_read) && (
          <button onClick={readAll} className="btn-secondary btn-sm">Mark all as read</button>
        )}
      </div>
      
      <article className="card">
        <StatusBlock loading={loading} error={error} hasData={notifications.length > 0} emptyMessage="You're all caught up! 🎉">
          <div className="list">
            {notifications.map((item) => (
              <div key={item.id} className={`notif-item ${!item.is_read ? 'unread' : ''}`}>
                {!item.is_read ? (
                  <div className="notif-dot"></div>
                ) : (
                  <div style={{ width: '8px' }}></div>
                )}
                <div className="notif-body">
                  <div className="notif-type">{item.type.replace(/_/g, ' ')}</div>
                  <div className="notif-message">{item.message}</div>
                </div>
                <div className="notif-actions">
                  {!item.is_read && (
                    <button onClick={() => readOne(item.id)} className="btn-secondary btn-sm" data-tooltip="Mark as read">✓</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </StatusBlock>
      </article>
    </div>
  );
}
