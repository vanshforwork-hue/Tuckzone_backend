import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing';
import { apiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { printReceipt } from '../../utils/printReceipt';
import { isBillingAdmin, money } from '../../utils/billingLogic';
import { BillingHeader, Modal } from './BillingShared';
import './Billing.css';

export default function BillDetailPage() {
  const { id } = useParams();
  const { role } = useAuth();
  const [bill, setBill] = useState(null);
  const [error, setError] = useState('');
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    setBill(null);
    setError('');
    billingApi.getBill(id).then(setBill).catch((e) => setError(apiErrorMessage(e, 'Failed to load bill')));
  }, [id]);

  if (error) return <div className="bp-wrap bp-narrow"><BillingHeader title="Bill" back="/billing/bills" /><p className="text-error">{error}</p></div>;
  if (!bill) return <div className="loading-state">Loading bill...</div>;
  const c = bill.currencySymbol;

  const doVoid = async (e) => {
    e.preventDefault();
    if (voiding) return;
    if (!reason.trim()) return toast.error('Enter a reason');
    setVoiding(true);
    try {
      setBill(await billingApi.voidBill(bill.id, reason.trim()));
      setVoidOpen(false);
      setReason('');
      toast.success('Bill voided');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not void the bill'));
    } finally {
      setVoiding(false);
    }
  };

  const print = () => {
    try { printReceipt(bill); } catch (e) { toast.error(e.message || 'Print failed'); }
  };

  return (
    <div className="bp-wrap bp-narrow">
      <BillingHeader title={bill.invoiceNumber} back="/billing/bills" />
      <div className="card">
        <h2>{bill.businessName}</h2>
        {bill.address && <small className="text-muted">{bill.address}</small>}
        {bill.gstin && <small className="text-muted"> · GSTIN: {bill.gstin}</small>}
        <p className="bp-hint">{new Date(bill.createdAt).toLocaleString('en-IN')} · {bill.createdByName}</p>
        {bill.status === 'VOID' && (
          <p><span className="badge badge-error">VOID</span> <small>Reason: {bill.voidReason}</small></p>
        )}
        <dl className="bp-totals">
          {bill.lines.map((l, i) => <div key={i}><dt>{l.itemName} x{l.quantity}</dt><dd>{money(c, l.lineTotal)}</dd></div>)}
          <div><dt>Subtotal</dt><dd>{money(c, bill.subtotal)}</dd></div>
          {bill.gstAmount > 0 && <div><dt>GST {bill.gstPercent}%</dt><dd>{money(c, bill.gstAmount)}</dd></div>}
          <div className="bp-total"><dt>Total</dt><dd>{money(c, bill.total)}</dd></div>
        </dl>
        <p className="bp-hint">
          {bill.paymentMethod ? `Payment: ${bill.paymentMethod} — recorded manually, not verified` : 'Payment method not recorded'}
        </p>
        {bill.footerMessage && <p className="bp-hint">{bill.footerMessage}</p>}
      </div>

      <div className="bp-actions bp-stack">
        <button type="button" className="btn-primary" onClick={print}><Printer size={16} /> Print receipt</button>
        {isBillingAdmin(role) && bill.status === 'COMPLETED' && (
          <button type="button" className="btn-danger" onClick={() => setVoidOpen(true)}>Void bill</button>
        )}
      </div>

      {voidOpen && (
        <Modal title="Void this bill?" onClose={() => setVoidOpen(false)}>
          <form onSubmit={doVoid}>
            <p>The bill stays on record but is removed from sales totals. This cannot be undone.</p>
            <div className="form-group">
              <label htmlFor="bp-reason">Reason <span className="required-mark">*</span></label>
              <input id="bp-reason" type="text" value={reason} maxLength={255} required autoFocus onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setVoidOpen(false)}>Cancel</button>
              <button type="submit" className="btn-danger" disabled={voiding}>{voiding ? 'Voiding...' : 'Void bill'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
