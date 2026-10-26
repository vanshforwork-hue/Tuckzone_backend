import type { Bill } from '../api/billing';

/** Pure ESC/POS encoder for the saved bill snapshot. No React Native imports (node-testable). */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** Characters per line: 32 for 58 mm paper, 48 for 80 mm (Font A). */
export type PaperWidth = 32 | 48;

/**
 * Thermal printers ship with a code page we cannot detect, so only printable ASCII is sent.
 * The rupee sign becomes "Rs."; accents are stripped; anything else becomes '?'.
 */
export function toAscii(s: string): string {
  return s
    .replace(/₹/g, 'Rs.')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '?');
}

const money = (cur: string, n: number) => `${toAscii(cur)}${n.toFixed(2)}`;

/** "left ..... right" within width; the left side is truncated so the amount is never cut. */
export function twoCol(left: string, right: string, w: number): string {
  const l = toAscii(left);
  const r = toAscii(right);
  const room = Math.max(w - r.length - 1, 0);
  return `${l.length > room ? l.slice(0, room) : l.padEnd(room)} ${r}`;
}

function wrap(s: string, w: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of toAscii(s).split(/\s+/).filter(Boolean)) {
    if (word.length > w) {
      if (line) out.push(line);
      for (let i = 0; i < word.length; i += w) out.push(word.slice(i, i + w));
      line = '';
    } else if (!line) line = word;
    else if (line.length + 1 + word.length <= w) line += ` ${word}`;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

class Buf {
  bytes: number[] = [];
  raw(...b: number[]) { this.bytes.push(...b); return this; }
  text(s: string) { for (const ch of toAscii(s)) this.bytes.push(ch.charCodeAt(0)); return this; }
  line(s = '') { return this.text(s).raw(LF); }
  align(a: 0 | 1 | 2) { return this.raw(ESC, 0x61, a); }
  bold(on: boolean) { return this.raw(ESC, 0x45, on ? 1 : 0); }
}

const init = (b: Buf) => b.raw(ESC, 0x40);
// feed, then partial cut (printers without a cutter ignore it)
const cut = (b: Buf) => b.raw(LF, LF, LF, GS, 0x56, 0x42, 0x00);

export function receiptEscPos(bill: Bill, width: PaperWidth = 32): Uint8Array {
  const c = bill.currencySymbol;
  const rule = '-'.repeat(width);
  const b = init(new Buf());
  b.align(1).bold(true);
  wrap(bill.businessName, width).forEach((l) => b.line(l));
  b.bold(false);
  [bill.address, bill.phone && `Ph: ${bill.phone}`, bill.gstin && `GSTIN: ${bill.gstin}`]
    .filter(Boolean)
    .forEach((s) => wrap(s as string, width).forEach((l) => b.line(l)));
  b.align(0).line(rule).line(`Bill: ${bill.invoiceNumber}`).line(new Date(bill.createdAt).toLocaleString('en-IN'));
  if (bill.status === 'VOID') b.align(1).bold(true).line('*** VOID ***').bold(false).align(0);
  b.line(rule);
  for (const l of bill.lines) {
    const [first, ...rest] = wrap(`${l.itemName} x${l.quantity}`, width - 10);
    b.line(twoCol(first ?? '', money(c, l.lineTotal), width));
    rest.forEach((r) => b.line(r));
  }
  b.line(rule).line(twoCol('Subtotal', money(c, bill.subtotal), width));
  if (bill.gstAmount > 0) b.line(twoCol(`GST ${bill.gstPercent}%`, money(c, bill.gstAmount), width));
  b.bold(true).line(twoCol('TOTAL', money(c, bill.total), width)).bold(false);
  if (bill.paymentMethod) wrap(`Paid by: ${bill.paymentMethod} (recorded manually)`, width).forEach((l) => b.line(l));
  if (bill.footerMessage) {
    b.line().align(1);
    wrap(bill.footerMessage, width).forEach((l) => b.line(l));
  }
  return Uint8Array.from(cut(b).bytes);
}

/** Short diagnostic receipt for the Test print button. Contains no sale data. */
export function testEscPos(width: PaperWidth = 32): Uint8Array {
  const b = init(new Buf()).align(1).bold(true).line('TuckZone').bold(false).line('Printer test').align(0);
  b.line('-'.repeat(width)).line(new Date().toLocaleString('en-IN')).line('If you can read this,').line('the printer works.');
  return Uint8Array.from(cut(b).bytes);
}

/** Split into BLE-sized writes; a single GATT write above the negotiated MTU fails or truncates. */
export function chunk(data: Uint8Array, size: number): Uint8Array[] {
  if (size < 1) throw new Error('chunk size must be positive');
  const out: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += size) out.push(data.subarray(i, i + size));
  return out;
}
