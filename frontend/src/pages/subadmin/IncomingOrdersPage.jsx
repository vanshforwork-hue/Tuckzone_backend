import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Search, RefreshCw, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAdminOrders, updateOrderStatus } from '../../api/admin';
import { orderStatusLabel } from '../../utils/format';
import toast from 'react-hot-toast';
import './IncomingOrdersPage.css';

/** The table only shows "Placed"/"Delivered", so the filter mirrors that: 'PLACED' here
 *  means "not yet delivered" (every status up to and including REJECTED/CANCELLED), not
 *  literally the PLACED enum value. The real per-order status still drives which action
 *  buttons render - this filter only narrows which rows are visible. */
const STATUS_OPTIONS = ['ALL', 'PLACED', 'DELIVERED'];
const PAGE_SIZE = 10;

function matchesFilter(order, filter) {
  if (filter === 'ALL') return true;
  return orderStatusLabel(order.status) === (filter === 'PLACED' ? 'Placed' : 'Delivered');
}

export default function IncomingOrdersPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const [deliveryPerson, setDeliveryPerson] = useState({});

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, search]);

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

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const visibleOrders = useMemo(() => {
    let result = orders;

    if (statusFilter !== 'ALL') {
      result = result.filter((order) => matchesFilter(order, statusFilter));
    }

    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      result = result.filter((order) =>
        order.orderNumber.toLowerCase().includes(needle) ||
        (order.studentName || '').toLowerCase().includes(needle) ||
        order.recipientName.toLowerCase().includes(needle));
    }

    const sorted = [...result].sort((a, b) => {
      let diff = 0;
      if (sortKey === 'createdAt') {
        diff = new Date(a.createdAt) - new Date(b.createdAt);
      } else if (sortKey === 'totalAmount') {
        diff = a.totalAmount - b.totalAmount;
      }
      return sortDir === 'asc' ? diff : -diff;
    });

    return sorted;
  }, [orders, statusFilter, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(visibleOrders.length / PAGE_SIZE));
  const pagedOrders = visibleOrders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const classSection = (order) => {
    if (!order.studentClass) return '—';
    return order.studentSection ? `${order.studentClass}-${order.studentSection}` : order.studentClass;
  };

  // Delivered is the only status Admin/Subadmin can set — no intermediate kitchen-workflow
  // steps left. Delivery person is optional context, not a gate on the action.
  const renderActionButtons = (order) => {
    if (order.status !== 'PLACED') {
      return <span className="text-muted">No actions</span>;
    }
    return (
      <div className="dispatch-form">
        <input
          type="text"
          placeholder="Delivery person (optional)"
          value={deliveryPerson[order.id] || ''}
          onChange={(e) => setDeliveryPerson({ ...deliveryPerson, [order.id]: e.target.value })}
        />
        <button className="btn-success" onClick={() => updateStatusAction(order.id, 'DELIVERED')}>Mark Delivered</button>
      </div>
    );
  };

  return (
    <div className="admin-container">
      <div className="page-header flex-between">
        <div>
          <h1>Incoming Orders</h1>
          <p>Track, search and action today&apos;s orders.</p>
        </div>
        <button className="btn-icon" onClick={fetchOrders} title="Refresh orders">
          <RefreshCw size={20} className={loading ? 'spinner' : ''} />
        </button>
      </div>

      <div className="orders-toolbar">
        <div className="date-picker-wrapper inline">
          <Calendar size={18} className="text-amber" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="date-input"
          />
        </div>

        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by order #, student name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="status-select">
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status === 'ALL' ? 'All' : orderStatusLabel(status === 'PLACED' ? 'PLACED' : 'DELIVERED')}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-state">Loading orders...</div>
      ) : pagedOrders.length === 0 ? (
        <div className="empty-state">No orders found for this filter.</div>
      ) : (
        <>
          <div className="orders-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Student Name</th>
                  <th>Class/Section</th>
                  <th>Roll No</th>
                  <th>Location</th>
                  <th>Items</th>
                  <th className="sortable" onClick={() => toggleSort('totalAmount')}>
                    Total <ArrowUpDown size={12} />
                  </th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th className="sortable" onClick={() => toggleSort('createdAt')}>
                    Date/Time <ArrowUpDown size={12} />
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="order-number">{order.orderNumber}</td>
                    <td>{order.studentName || order.recipientName}</td>
                    <td>{classSection(order)}</td>
                    <td>{order.studentRollNumber || '—'}</td>
                    <td>{order.deliveryLocation || '—'}</td>
                    <td>
                      <ul className="items-list">
                        {order.items.map((item, index) => (
                          <li key={`${item.menuItemId}-${index}`}>{item.quantity}× {item.itemName}</li>
                        ))}
                      </ul>
                    </td>
                    <td>₹{order.totalAmount}</td>
                    <td>
                      <span className={`badge ${order.paymentStatus === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`badge status-badge status-${order.status.toLowerCase()}`}>
                        {orderStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="text-muted">
                      {new Date(order.createdAt).toLocaleDateString()}<br />
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>{renderActionButtons(order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span className="text-muted">
              Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, visibleOrders.length)} of {visibleOrders.length}
            </span>
            <div className="pagination-controls">
              <button className="btn-icon" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={18} />
              </button>
              <span>Page {page + 1} of {totalPages}</span>
              <button className="btn-icon" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
