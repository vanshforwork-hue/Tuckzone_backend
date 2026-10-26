import { Platform, Share } from 'react-native';
import type { Bill } from '../api/billing';
import { receiptHtml, receiptText } from './receiptFormat';
import { receiptEscPos } from './escpos';
import * as ble from './webBluetoothPrinter';
import * as nativePrinter from './nativePrinter';

/**
 * Web: opens the browser print dialog for the receipt in a hidden iframe.
 * Web with a connected Bluetooth printer: sends ESC/POS directly (no silent fallback on failure).
 * Android: direct Bluetooth ESC/POS print (nativePrinter); the share sheet is only the explicit shareReceipt.
 * Reprinting only reads the bill; it never creates a sale.
 */
/** Explicit, user-chosen fallback: the receipt text goes to the system share sheet. */
export async function shareReceipt(b: Bill): Promise<void> {
  await Share.share({ message: receiptText(b), title: b.invoiceNumber });
}

export async function printReceipt(b: Bill): Promise<void> {
  if (Platform.OS !== 'web') {
    await nativePrinter.printBill(b); // direct to the Bluetooth printer; no share sheet, no silent fallback
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
