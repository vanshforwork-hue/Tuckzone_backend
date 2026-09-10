import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { getNotifications } from '../api/notifications';
import EmptyState from '../components/EmptyState';
import toast from 'react-hot-toast';
import './NotificationsPage.css';

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await getNotifications();
      setItems(data);
    } catch (err) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="notifications-container">
      <div className="page-header">
        <h1>Notifications</h1>
        <p>Updates about your orders, wallet, and account</p>
      </div>

      {loading ? (
        <div className="loading-state">Loading notifications...</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          message="You'll see updates about your orders and wallet here."
        />
      ) : (
        <div className="notifications-list">
          {items.map((item) => (
            <div className="notification-card" key={item.id}>
              <span className="notification-icon">
                <Bell size={16} />
              </span>
              <div className="notification-body">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <span className="notification-time">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
