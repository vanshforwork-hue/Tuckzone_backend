import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing';
import { receiptHtml, RECEIPT_WIDTHS, getReceiptWidth, saveReceiptWidth, parseReceiptWidth } from '../../utils/billingLogic';
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
  const [width, setWidth] = useState(getReceiptWidth);
  const supported = typeof window !== 'undefined' && typeof window.print === 'function';

  // Settings only brand the preview; the page still works if they fail to load.
  useEffect(() => { billingApi.settings().then(setSettings).catch(() => {}); }, []);

  const bill = useMemo(() => sampleBill(settings), [settings]);
  const html = useMemo(() => receiptHtml(bill, width), [bill, width]);

  const pickWidth = (w) => { setWidth(parseReceiptWidth(w)); saveReceiptWidth(w); setStatus(null); };

  const testPrint = () => {
    try {
      printReceipt(bill, width);
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
        <fieldset className="bp-width">
          <legend>Paper width</legend>
          {RECEIPT_WIDTHS.map((w) => (
            <label key={w} className={`bp-chip ${width === w ? 'on' : ''}`}>
              <input type="radio" name="receipt-width" value={w} checked={width === w} onChange={() => pickWidth(w)} /> {w} mm
            </label>
          ))}
        </fieldset>
        <p className="bp-hint">Saved in this browser only. It sizes the receipt, but it cannot change the printer itself: the printer driver or print dialog must use the same paper size.</p>
        <div className="bp-actions">
          <button type="button" className="btn-primary" onClick={testPrint} disabled={!supported}><Printer size={16} /> Test Print</button>
          <Link to="/billing" className="btn-secondary bp-tool"><Calculator size={16} /> Back to counter</Link>
        </div>
        {status && <p className={status.ok ? 'bp-hint' : 'text-error'} role="status">{status.text}</p>}
      </div>

      <div className="card bp-stack">
        <h2 className="bp-h2">Receipt preview ({width} mm)</h2>
        <iframe title="Receipt preview" className="bp-preview" style={{ width: `${width + 8}mm` }} srcDoc={html} sandbox="" />
      </div>

      <div className="card bp-stack">
        <h2 className="bp-h2">Connect your printer</h2>
        <p className="bp-hint">Three separate things. TuckZone only does step 2.</p>
        <ol className="bp-steps">
          <li><b>Connect the printer to your device.</b> Windows: Settings &gt; Bluetooth &amp; devices &gt; Printers &amp; scanners &gt; Add device (or plug in USB). Android: Settings &gt; Connected devices &gt; Pair new device, then install the printer's print service or app if it has one.</li>
          <li><b>Pick it in the browser print dialog.</b> Press Test Print. In Chrome's dialog, open Destination (Windows) or Select printer (Android) and choose your printer. Set paper size to match the width above, margins to None or Default, and scale to 100%.</li>
          <li><b>Direct Bluetooth printing is not supported</b> on the website. A printer that is only paired to Bluetooth, with no system print driver or print service, will not appear in the dialog.</li>
        </ol>
        <h3 className="bp-h3">Troubleshooting</h3>
        <ul className="bp-steps">
          <li>Printer missing from the dialog: it is not installed for the system yet. Add it in the system settings and reopen the dialog.</li>
          <li>No 57 mm paper size offered: choose the closest roll size, or add a custom 57 mm paper in the printer driver's preferences (Windows: Printer properties &gt; Preferences). The browser cannot force the hardware paper size.</li>
          <li>Receipt cut off or tiny: set Scale to 100% and Margins to None, and make sure the paper width here matches the loaded roll.</li>
          <li>Dialog does not open: allow pop-ups and printing for this site, or try Chrome.</li>
        </ul>
      </div>
    </div>
  );
}
