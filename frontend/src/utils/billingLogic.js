/** Pure counter-billing helpers (no React, no network) so they can be unit-tested with node:test. */

/** Mirror the server: PosController is STAFF = both roles, ADMIN = Canteen Admin only. */
export const BILLING_ROLES = ['CANTEEN_ADMIN', 'SUB_ADMIN'];
export const BILLING_ADMIN_ROLES = ['CANTEEN_ADMIN'];

export const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'OTHER'];
export const MAX_QTY = 999;

export const canUseBilling = (role) => BILLING_ROLES.includes(role);
export const isBillingAdmin = (role) => BILLING_ADMIN_ROLES.includes(role);

/**
 * Toolbar for a role, grouped Sell / Sales / Menu / Tools. Reports/settings/void are Canteen
 * Admin only (the server enforces it too). Entries without `to` are in-page actions.
 */
export function billingMenuGroups(role) {
  if (!canUseBilling(role)) return [];
  const admin = isBillingAdmin(role);
  const groups = [
    { key: 'sell', label: 'Sell', entries: [{ key: 'held', label: 'Held bills' }, { key: 'repeat', label: 'Repeat last' }] },
    { key: 'sales', label: 'Sales', entries: [{ key: 'bills', label: 'Bills', to: '/billing/bills' }] },
    { key: 'menu', label: 'Menu', entries: [{ key: 'catalog', label: admin ? 'Menu / Catalog' : 'Menu availability', to: '/billing/catalog' }] },
    { key: 'tools', label: 'Tools', entries: [{ key: 'printer', label: 'Printer', to: '/billing/printer' }] },
  ];
  if (admin) {
    groups[1].entries.push({ key: 'reports', label: 'Reports', to: '/billing/reports' });
    groups[3].entries.push({ key: 'settings', label: 'Billing settings', to: '/billing/settings' });
  }
  return groups;
}

export const billingMenuEntries = (role) => billingMenuGroups(role).flatMap((g) => g.entries);

/** Save the bill ONCE, then try to print it. A print failure never undoes or repeats the save. */
export async function saveThenPrint(save, print) {
  const bill = await save(); // a save failure propagates: nothing is printed, the cart is untouched
  return { bill, printError: await tryPrint(bill, print) };
}

/** Print / Retry Print for a SAVED bill: returns the error message or null. Never saves. */
export async function tryPrint(bill, print) {
  try {
    await print(bill);
    return null;
  } catch (e) {
    return e?.message || 'Printing failed.';
  }
}

export const savedButNotPrinted = (reason) => `Bill saved, but printing failed: ${reason} Retry printing this bill.`;

/**
 * Cart total preview in integer paise (no float drift), mirroring the server's exclusive
 * GST rounded half-up. The server's figures on the returned bill are the authoritative ones.
 */
export function previewTotals(lines, gstPercent, gstEnabled) {
  const subtotalPaise = lines.reduce((sum, l) => sum + Math.round(l.price * 100) * l.quantity, 0);
  const pctHundredths = gstEnabled ? Math.round(gstPercent * 100) : 0;
  const gstPaise = Math.floor((subtotalPaise * pctHundredths + 5000) / 10000);
  return { subtotal: subtotalPaise / 100, gst: gstPaise / 100, total: (subtotalPaise + gstPaise) / 100 };
}

/** Returns a new cart ({itemId: qty}) with qty clamped to 0..999; 0 removes the line. */
export function setCartQty(cart, id, qty) {
  const next = { ...cart };
  const q = Math.max(0, Math.min(MAX_QTY, Math.floor(qty) || 0));
  if (q === 0) delete next[id];
  else next[id] = q;
  return next;
}

/** Builds a cart from item/qty pairs against today's catalog; counts what can't be sold. */
export function cartFromLines(input, byId) {
  const cart = {};
  let skipped = 0;
  for (const l of input) {
    const item = byId.get(l.itemId);
    if (item && item.available) cart[item.id] = Math.min(MAX_QTY, (cart[item.id] ?? 0) + l.quantity);
    else skipped++;
  }
  return { cart, skipped };
}

export function filterItems(items, category, search) {
  const q = search.trim().toLowerCase();
  return items.filter((i) => (category === 'ALL' || i.categoryId === category) && (!q || i.name.toLowerCase().includes(q)));
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const newIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const money = (cur, n) => `${cur}${Number(n).toFixed(2)}`;

export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Receipt paper width in mm. A browser-local preference (no backend setting): only the two
 * whitelisted numbers ever reach the CSS, anything else falls back to 80.
 */
export const RECEIPT_WIDTHS = [57, 80];
export const DEFAULT_RECEIPT_WIDTH = 80;
const WIDTH_KEY = 'tz.receiptWidthMm';
const RECEIPT_LAYOUT = { 57: { margin: 2, font: 11 }, 80: { margin: 4, font: 12 } };

export const parseReceiptWidth = (v) => (RECEIPT_WIDTHS.includes(Number(v)) ? Number(v) : DEFAULT_RECEIPT_WIDTH);

export function getReceiptWidth() {
  try { return parseReceiptWidth(globalThis.localStorage?.getItem(WIDTH_KEY)); } catch { return DEFAULT_RECEIPT_WIDTH; }
}

export function saveReceiptWidth(w) {
  try { globalThis.localStorage?.setItem(WIDTH_KEY, String(parseReceiptWidth(w))); } catch { /* storage blocked: choice lasts for this page view only */ }
}

/** Print-ready HTML sized for a thermal roll of the chosen width; every field is escaped. */
export function receiptHtml(b, widthMm = getReceiptWidth()) {
  const w = parseReceiptWidth(widthMm);
  const { margin, font } = RECEIPT_LAYOUT[w];
  const c = b.currencySymbol;
  const rows = b.lines
    .map((l) => `<tr><td>${esc(l.itemName)} x${l.quantity}</td><td class="r">${esc(money(c, l.lineTotal))}</td></tr>`)
    .join('');
  const line = (label, v) => `<tr><td>${label}</td><td class="r">${esc(money(c, v))}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(b.invoiceNumber)}</title>
<style>@page{size:${w}mm auto;margin:${margin}mm}html,body{margin:0}body{font:${font}px monospace;width:${w - 2 * margin}mm;overflow-wrap:anywhere}
h1{font-size:${Math.round((font + 4) * 1.2)}px;font-weight:800;line-height:1.2;text-align:center;margin:0 0 2px}.c{text-align:center}table{width:100%;border-collapse:collapse;table-layout:fixed}
td{vertical-align:top}td.r{width:34%}.r{text-align:right}hr{border:0;border-top:1px dashed #000}.v{text-align:center;font-weight:bold;font-size:16px}</style></head><body>
<h1>${esc(b.businessName)}</h1>
${b.address ? `<div class="c">${esc(b.address)}</div>` : ''}${b.phone ? `<div class="c">Ph: ${esc(b.phone)}</div>` : ''}${b.gstin ? `<div class="c">GSTIN: ${esc(b.gstin)}</div>` : ''}
<hr><div>Bill: ${esc(b.invoiceNumber)}</div><div>${esc(new Date(b.createdAt).toLocaleString('en-IN'))}</div>
${b.status === 'VOID' ? '<div class="v">*** VOID ***</div>' : ''}<hr>
<table>${rows}</table><hr><table>${line('Subtotal', b.subtotal)}${b.gstAmount > 0 ? line(`GST ${esc(b.gstPercent)}%`, b.gstAmount) : ''}
<tr><td><b>TOTAL</b></td><td class="r"><b>${esc(money(c, b.total))}</b></td></tr></table>
${b.paymentMethod ? `<div>Paid by: ${esc(b.paymentMethod)} (recorded manually)</div>` : ''}
${b.footerMessage ? `<hr><div class="c">${esc(b.footerMessage)}</div>` : ''}</body></html>`;
}
