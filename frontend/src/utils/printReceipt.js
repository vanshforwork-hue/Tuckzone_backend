import { receiptHtml } from './billingLogic';

/** Opens the browser print dialog for a stored bill. Reprinting only reads; it never creates a sale. */
export function printReceipt(bill) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    throw new Error('Printing is not available in this browser');
  }
  doc.open();
  doc.write(receiptHtml(bill));
  doc.close();
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 60_000);
}
