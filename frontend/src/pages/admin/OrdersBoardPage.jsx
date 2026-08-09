import React, { useEffect, useState } from 'react';
import { Calendar, RefreshCw } from 'lucide-react';
import { getAdminOrders, updateOrderStatus } from '../../api/admin';
import { classLabel, orderStatusLabel } from '../../utils/format';
import toast from 'react-hot-toast';
import './OrdersBoardPage.css';

/** The board only shows "Placed"/"Delivered", so the filter mirrors that: 'PLACED' here
 *  means "not yet delivered" (every status up to and including REJECTED/CANCELLED), not
 *  literally the PLACED enum value. The real per-order status still drives which action
 *  buttons render - this filter only narrows which cards are visible. */
const STATUS_FILTERS = ['ALL', 'PLACED', 'DELIVERED'];

function matchesFilter(order, filter) {
  if (filter === 'ALL') return true;
  return orderStatusLabel(order.status) === (filter === 'PLACED' ? 'Placed' : 'Delivered');
}

export default function OrdersBoardPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deliveryPerson, setDeliveryPerson] = useState({});

  useEffect(() => {
    fetchOrders();
  }, [date]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await getAdminOrders(date);
      setOrders(data);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const updateStatusAction = async (orderId, status) => {
    try {
      const payload = { status };
      if (deliveryPerson[orderId]) {
        payload.deliveryPersonName = deliveryPerson[orderId];
      }
      await updateOrderStatus(orderId, payload);
      toast.success('Order status updated');
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    }
  };

  const filteredOrders = orders.filter((order) => matchesFilter(order, statusFilter));

  // Delivered is the only status Admin/Subadmin can set — no intermediate kitchen-workflow
  // steps left. Delivery person is optional context, not a gate on the action.
  const renderActionButtons = (order) => {
    if (order.status !== 'PLACED') {
      return <div className="status-locked text-muted">No actions available</div>;
    }
    return (
      <div className="dispatch-form">
        <input
          type="text"
          placeholder="Delivery person name (optional)"
          value={deliveryPerson[order.id] || ''}
          onChange={(e) => setDeliveryPerson({ ...deliveryPerson, [order.id]: e.target.value })}
        />
        <button className="btn-success w-100" onClick={() => updateStatusAction(order.id, 'DELIVERED')}>
          Mark Delivered
        </button>
      </div>
    );
  };

  return (
    <div className="admin-container">
      <div className="page-header flex-between">
        <div>
          <h1>Kitchen Orders Board</h1>
          <p>Mark orders delivered as they go out.</p>
        </div>
        <button className="btn-icon" onClick={fetchOrders} title="Refresh orders">
          <RefreshCw size={24} className={loading ? 'spinner' : ''} />
        </button>
      </div>

      <div className="board-controls">
        <div className="date-picker-wrapper inline">
          <Calendar size={20} className="text-amber" />
          <input
            type="date"
            value={date}
            min="2026-07-21"
            onChange={(e) => setDate(e.target.value)}
            className="date-input"
          />
        </div>

        <div className="status-filters-pills">
          {STATUS_FILTERS.map((status) => {
            const count = orders.filter((order) => matchesFilter(order, status)).length;
            const label = status === 'ALL' ? 'All' : orderStatusLabel(status === 'PLACED' ? 'PLACED' : 'DELIVERED');
            return (
              <button
                key={status}
                className={`pill-btn ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {label} <span className="count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="orders-board-grid">
        {filteredOrders.length === 0 ? (
          <div className="empty-state">No orders found for this status.</div>
        ) : (
          filteredOrders.map((order) => (
            <div className={`kitchen-card status-${order.status.toLowerCase()}`} key={order.id}>
              <div className="kc-header">
                <h3>{order.orderNumber}</h3>
                <div className="kc-header-badges">
                  <span className={`status-badge-pill status-${order.status.toLowerCase()}`}>{orderStatusLabel(order.status)}</span>
                  <span className="slot-badge">{order.slotName}</span>
                </div>
              </div>

              <div className="kc-body">
                <div className="recipient-info">
                  <strong>To:</strong> {order.recipientName}
                  {order.studentClass && (
                    <>
                      <br />
                      <strong>Class:</strong> {classLabel(order.studentClass, order.studentSection)}
                    </>
                  )}
                  <br />
                  <strong>Loc:</strong> {order.deliveryLocation}
                </div>

                <ul className="kc-items">
                  {order.items.map((item, index) => (
                    <li key={`${item.menuItemId}-${index}`}>
                      <span className="qty">{item.quantity}x</span> {item.itemName}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="kc-footer">
                {renderActionButtons(order)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
