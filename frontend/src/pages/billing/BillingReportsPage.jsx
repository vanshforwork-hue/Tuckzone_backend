import React, { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing';
import { apiErrorMessage } from '../../api/client';
import { todayIso } from '../../utils/billingLogic';
import { BillingHeader } from './BillingShared';
import './Billing.css';

const GRANULARITIES = [['DAY', 'Day'], ['WEEK', 'Week'], ['MONTH', 'Month']];
const fmt = (n) => Number(n || 0).toFixed(2);

export default function BillingReportsPage() {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [g, setG] = useState('DAY');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await billingApi.summary(from, to, g));
    } catch (e) {
      setData(null);
      toast.error(apiErrorMessage(e, 'Failed to load report'));
    } finally {
      setLoading(false);
    }
  }, [from, to, g]);
  useEffect(() => { load(); }, [load]);

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const blob = await billingApi.exportXlsx(from, to);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billing-${from}_${to}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed — try a different date range');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bp-wrap bp-narrow">
      <BillingHeader title="Billing reports" subtitle="Completed bills only. Voided bills are excluded from sales." />
      <div className="bp-filters">
        <div className="form-group"><label htmlFor="bp-from">From</label>
          <input id="bp-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} /></div>
        <div className="form-group"><label htmlFor="bp-to">To</label>
          <input id="bp-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="bp-chips">
        {GRANULARITIES.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={g === key} className={`bp-chip ${g === key ? 'on' : ''}`} onClick={() => setG(key)}>{label}</button>
        ))}
        <button type="button" className="btn-secondary bp-export" onClick={exportXlsx} disabled={exporting}>
          <Download size={16} /> {exporting ? 'Exporting...' : 'Export XLSX'}
        </button>
      </div>

      {loading ? <div className="loading-state">Loading report...</div> : !data ? null : (
        <>
          <div className="card total-card">
            <dl className="bp-totals">
              <div><dt>Bills</dt><dd>{data.bills}</dd></div>
              <div><dt>Subtotal</dt><dd>{fmt(data.subtotal)}</dd></div>
              <div><dt>GST</dt><dd>{fmt(data.gst)}</dd></div>
              <div className="bp-total"><dt>Total sales</dt><dd>{fmt(data.total)}</dd></div>
              <div><dt>Voided ({data.voidedBills})</dt><dd>{fmt(data.voidedTotal)}</dd></div>
            </dl>
          </div>
          <Table title="By period" head={['Period', 'Bills', 'Total']} rows={data.periods.map((p) => [p.periodStart, p.bills, fmt(p.total)])} />
          <Table title="By payment method" head={['Method', 'Bills', 'Total']} rows={data.byPayment.map((p) => [p.method, p.bills, fmt(p.total)])} />
          <Table title="By item" head={['Item', 'Qty', 'Total']} rows={data.byItem.map((p) => [p.itemName, p.quantity, fmt(p.total)])} />
        </>
      )}
    </div>
  );
}

function Table({ title, head, rows }) {
  if (rows.length === 0) return null;
  return (
    <div className="card bp-table-card">
      <h2>{title}</h2>
      <div className="bp-table-scroll">
        <table className="bp-table">
          <thead><tr>{head.map((h, i) => <th key={h} className={i > 0 ? 'r' : ''}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j > 0 ? 'r' : ''}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
