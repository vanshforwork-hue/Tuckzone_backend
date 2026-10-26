import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing';
import { receiptHtml } from '../../utils/billingLogic';
import { printReceipt } from '../../utils/printReceipt';
import { BillingHeader } from './BillingShared';
import './Billing.css';

/** Local sample only: Test Print never calls the server, so it can never create a sale. */
function sampleBill(settings) {
  return {
    currencySymbol: settings?.currencySymbol || '₹',
    businessName: settings?.businessName || 'TuckZone',
    address: settings?.address,
    phone: settings?.phone,
    gstin: settings?.gstin,
    invoiceNumber: 'TEST-PRINT',
    createdAt: new Date().toISOString(),
    status: 'COMPLETED',
    lines: [
      { itemName: 'Sample item', quantity: 2, lineTotal: 40 },
      { itemName: 'Sample drink', quantity: 1, lineTotal: 20 },
    ],
    subtotal: 60,
    gstAmount: 0,
    gstPercent: 0,
    total: 60,
    footerMessage: 'TEST PRINT - NOT A SALE',
  };
}

export default function BillingPrinterPage() {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null); // { ok, text }
  const supported = typeof window !== 'undefined' && typeof window.print === 'function';

  // Settings only brand the preview; the page still works if they fail to load.
  useEffect(() => { billingApi.settings().then(setSettings).catch(() => {}); }, []);

  const bill = useMemo(() => sampleBill(settings), [settings]);
  const html = useMemo(() => receiptHtml(bill), [bill]);

  const testPrint = () => {
    try {
      printReceipt(bill);
      setStatus({ ok: true, text: 'Print dialog opened. Choose your printer there. TuckZone cannot tell whether the page was actually printed.' });
    } catch (e) {
      const text = e.message || 'Could not open the print dialog';
      setStatus({ ok: false, text });
      toast.error(text);
    }
  };

  return (
    <div className="bp-wrap bp-narrow">
      <BillingHeader title="Printer" subtitle="Receipts print through your browser's print dialog." />

      <div className="card">
        <h2 className="bp-h2">Printer status</h2>
        <p className="bp-hint" role="status">
          {supported
            ? 'Not detected. Browsers do not tell websites which printer is connected, so none is shown as connected. Direct Bluetooth printing is not available on the website.'
            : 'Printing is not available in this browser. Open TuckZone in Chrome, Edge or Safari.'}
        </p>
        <ol className="bp-steps">
          <li>Connect or pair your printer with this device in the system settings.</li>
          <li>Press Test Print and pick that printer in the print dialog.</li>
          <li>For a receipt roll, set the paper size to 80 mm and margins to none or default.</li>
        </ol>
        <div className="bp-actions">
          <button type="button" className="btn-primary" onClick={testPrint} disabled={!supported}><Printer size={16} /> Test Print</button>
          <Link to="/billing" className="btn-secondary bp-tool"><Calculator size={16} /> Back to counter</Link>
        </div>
        {status && <p className={status.ok ? 'bp-hint' : 'text-error'} role="status">{status.text}</p>}
      </div>

      <div className="card bp-stack">
        <h2 className="bp-h2">Receipt preview (80 mm)</h2>
        <iframe title="Receipt preview" className="bp-preview" srcDoc={html} sandbox="" />
      </div>
    </div>
  );
}
