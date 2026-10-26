/** Pure counter-billing helpers (no React, no network) so they can be unit-tested with node:test. */

/** Mirror the server: PosController is STAFF = both roles, ADMIN = Canteen Admin only. */
export const BILLING_ROLES = ['CANTEEN_ADMIN', 'SUB_ADMIN'];
export const BILLING_ADMIN_ROLES = ['CANTEEN_ADMIN'];

export const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'OTHER'];
export const MAX_QTY = 999;

export const canUseBilling = (role) => BILLING_ROLES.includes(role);
export const isBillingAdmin = (role) => BILLING_ADMIN_ROLES.includes(role);

/** Toolbar for a role. Reports/settings/void are Canteen Admin only (the server enforces it too). */
export function billingMenuEntries(role) {
  if (!canUseBilling(role)) return [];
  const admin = isBillingAdmin(role);
  const entries = [
    { key: 'held', label: 'Held bills' },
    { key: 'repeat', label: 'Repeat last' },
    { key: 'bills', label: 'Bills', to: '/billing/bills' },
    { key: 'catalog', label: admin ? 'Menu / Catalog' : 'Menu availability', to: '/billing/catalog' },
    { key: 'printer', label: 'Printer', to: '/billing/printer' },
  ];
  if (admin) {
    entries.push({ key: 'reports', label: 'Reports', to: '/billing/reports' });
    entries.push({ key: 'settings', label: 'Billing settings', to: '/billing/settings' });
  }
  return entries;
}

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

/** Print-ready HTML sized for a thermal-width roll; every field is escaped. */
export function receiptHtml(b) {
  const c = b.currencySymbol;
  const rows = b.lines
    .map((l) => `<tr><td>${esc(l.itemName)} x${l.quantity}</td><td class="r">${esc(money(c, l.lineTotal))}</td></tr>`)
    .join('');
  const line = (label, v) => `<tr><td>${label}</td><td class="r">${esc(money(c, v))}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(b.invoiceNumber)}</title>
<style>@page{size:80mm auto;margin:4mm}body{font:12px monospace;width:72mm;margin:0}
h1{font-size:16px;text-align:center;margin:0}.c{text-align:center}table{width:100%;border-collapse:collapse}
.r{text-align:right}hr{border:0;border-top:1px dashed #000}.v{text-align:center;font-weight:bold;font-size:16px}</style></head><body>
<h1>${esc(b.businessName)}</h1>
${b.address ? `<div class="c">${esc(b.address)}</div>` : ''}${b.phone ? `<div class="c">Ph: ${esc(b.phone)}</div>` : ''}${b.gstin ? `<div class="c">GSTIN: ${esc(b.gstin)}</div>` : ''}
<hr><div>Bill: ${esc(b.invoiceNumber)}</div><div>${esc(new Date(b.createdAt).toLocaleString('en-IN'))}</div>
${b.status === 'VOID' ? '<div class="v">*** VOID ***</div>' : ''}<hr>
<table>${rows}</table><hr><table>${line('Subtotal', b.subtotal)}${b.gstAmount > 0 ? line(`GST ${esc(b.gstPercent)}%`, b.gstAmount) : ''}
<tr><td><b>TOTAL</b></td><td class="r"><b>${esc(money(c, b.total))}</b></td></tr></table>
${b.paymentMethod ? `<div>Paid by: ${esc(b.paymentMethod)} (recorded manually)</div>` : ''}
${b.footerMessage ? `<hr><div class="c">${esc(b.footerMessage)}</div>` : ''}</body></html>`;
}
