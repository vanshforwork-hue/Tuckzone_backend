import React, { useEffect, useState } from 'react';
import { Package, Clock, CheckCircle, Truck } from 'lucide-react';
import { getMyOrders } from '../api/orders';
import { classLabel, orderStatusLabel } from '../utils/format';
import toast from 'react-hot-toast';
import './OrdersPage.css';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await getMyOrders();
      setOrders(data);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) =>
    status === 'DELIVERED'
      ? <CheckCircle size={20} className="text-green" />
      : <Clock size={20} className="text-blue" />;

  return (
    <div className="orders-container">
      <div className="page-header">
        <h1>My Orders</h1>
        <p>Track your food deliveries</p>
      </div>

      {loading ? (
        <div className="loading-state">Loading your orders...</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <Package size={48} className="text-amber" />
          <h2>No orders yet</h2>
          <p>Go to the menu to place your first order.</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div className="order-card" key={order.id}>
              <div className="order-header">
                <div className="order-id">
                  <h3>Order {order.orderNumber}</h3>
                  <span className="order-date">{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
                {order.status === 'PLACED' && order.paymentStatus === 'PENDING' ? (
                  <div className="status-badge status-payment-pending">
                    <Clock size={20} className="text-amber" />
                    <span>Payment pending</span>
                  </div>
                ) : (
                  <div className={`status-badge status-${order.status.toLowerCase()}`}>
                    {getStatusIcon(order.status)}
                    <span>{orderStatusLabel(order.status)}</span>
                  </div>
                )}
              </div>

              <div className="order-details-grid">
                <div className="detail-item">
                  <span className="label">Recess</span>
                  <span className="value">{order.slotName}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Recipient</span>
                  <span className="value">{order.recipientName}</span>
                </div>
                {order.recipientClass && (
                  <div className="detail-item">
                    <span className="label">Class</span>
                    <span className="value">{classLabel(order.recipientClass, order.recipientSection)}</span>
                  </div>
                )}
                <div className="detail-item">
                  <span className="label">Location</span>
                  <span className="value">{order.deliveryLocation}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Total Amount</span>
                  <span className="value highlight">₹{order.totalAmount}</span>
                </div>
              </div>

              <div className="order-items-table">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, index) => (
                      <tr key={`${item.menuItemId}-${index}`}>
                        <td>{item.itemName}</td>
                        <td>{item.quantity}</td>
                        <td>₹{item.unitPrice}</td>
                        <td>₹{item.lineTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="order-footer">
                {order.status === 'DELIVERED' && order.deliveryPersonName && (
                  <div className="delivery-info">
                    <Truck size={16} />
                    <span>Delivered by <strong>{order.deliveryPersonName}</strong></span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
