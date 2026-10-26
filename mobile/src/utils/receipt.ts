import { Platform, Share } from 'react-native';
import type { Bill } from '../api/billing';
import { receiptHtml, receiptText } from './receiptFormat';
import { receiptEscPos } from './escpos';
import * as ble from './webBluetoothPrinter';

/**
 * Web: opens the browser print dialog for the receipt in a hidden iframe.
 * Web with a connected Bluetooth printer: sends ESC/POS directly (no silent fallback on failure).
 * Native: no print dependency is bundled, so the receipt text goes to the system share sheet
 * (any installed print/PDF/messaging target). Native Bluetooth printing is not implemented.
 * Reprinting only reads the bill; it never creates a sale.
 */
export async function printReceipt(b: Bill): Promise<void> {
  if (Platform.OS !== 'web') {
    await Share.share({ message: receiptText(b), title: b.invoiceNumber });
    return;
  }
  if (ble.isConnected()) {
    try {
      await ble.send(receiptEscPos(b));
      return;
    } catch (e) {
      throw new Error(`${e instanceof Error ? e.message : 'Bluetooth print failed'} Disconnect the printer (Billing > Printing) to use browser print instead.`);
    }
  }
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    throw new Error('Printing is not available in this browser');
  }
  doc.open();
  doc.write(receiptHtml(b));
  doc.close();
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 60_000);
}
