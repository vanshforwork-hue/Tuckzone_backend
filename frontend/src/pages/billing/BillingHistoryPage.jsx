import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing';
import { apiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import EmptyState from '../../components/EmptyState';
import { printReceipt } from '../../utils/printReceipt';
import { todayIso } from '../../utils/billingLogic';
import { BillingHeader } from './BillingShared';
import './Billing.css';

const STATUSES = [['ALL', 'All'], ['COMPLETED', 'Completed'], ['VOID', 'Void']];

export default function BillingHistoryPage() {
  const { role } = useAuth();
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await billingApi.listBills({ from, to, status: status === 'ALL' ? undefined : status, q: q.trim() || undefined, size: 100 }));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to load bills'));
    } finally {
      setLoading(false);
    }
  }, [from, to, status, q]);
  useEffect(() => { load(); }, [load]);

  /** Reprint = read the stored bill and print it; nothing is created. */
  const reprint = async (id) => {
    try {
      printReceipt(await billingApi.getBill(id));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not print'));
    }
  };

  return (
    <div className="bp-wrap bp-narrow">
      <BillingHeader title="Bills" subtitle={role === 'SUB_ADMIN' ? 'Bills you created' : 'All bills'} />
      <div className="bp-filters">
        <div className="form-group"><label htmlFor="bp-from">From</label>
          <input id="bp-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} /></div>
        <div className="form-group"><label htmlFor="bp-to">To</label>
          <input id="bp-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="form-group"><label htmlFor="bp-q">Bill number</label>
          <input id="bp-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" /></div>
      </div>
      <div className="bp-chips">
        {STATUSES.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={status === key} className={`bp-chip ${status === key ? 'on' : ''}`} onClick={() => setStatus(key)}>{label}</button>
        ))}
      </div>

      {loading && !data ? <div className="loading-state">Loading bills...</div>
        : !data || data.content.length === 0 ? <EmptyState icon={Receipt} title="No bills found" message="Try a different date range." />
          : (
            <ul className="bp-list">
              {data.content.map((b) => (
                <li key={b.id} className="card bp-bill">
                  <Link to={`/billing/bills/${b.id}`} className="bp-bill-main">
                    <strong>{b.invoiceNumber}</strong>
                    <small className="text-muted">
                      {new Date(b.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      {' · '}{b.itemCount} items{b.paymentMethod ? ` · ${b.paymentMethod}` : ''}{b.createdByName ? ` · ${b.createdByName}` : ''}
                    </small>
                  </Link>
                  <div className="bp-bill-side">
                    <strong>{Number(b.total).toFixed(2)}</strong>
                    {b.status === 'VOID' && <span className="badge badge-error">VOID</span>}
                  </div>
                  <button type="button" className="bp-icon-btn" onClick={() => reprint(b.id)} aria-label={`Print ${b.invoiceNumber}`}><Printer size={18} /></button>
                </li>
              ))}
            </ul>
          )}
      {data && data.totalElements > data.content.length && (
        <p className="bp-hint">Showing {data.content.length} of {data.totalElements}. Narrow the date range to see the rest.</p>
      )}
    </div>
  );
}
