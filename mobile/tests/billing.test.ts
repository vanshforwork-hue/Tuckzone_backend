// Run: npm test  (Node's built-in runner; pure modules only, no React Native imports)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billingMenuEntries } from '../src/screens/billing/billingMenu.ts';
import { receiptHtml, receiptText } from '../src/utils/receiptFormat.ts';
import { previewTotals } from '../src/api/billingMath.ts';

const keys = (role?: string) => billingMenuEntries(role).map((e) => e.key);

test('admin sees menu/catalog, reports, settings and printer entries', () => {
  const k = keys('CANTEEN_ADMIN');
  for (const want of ['held', 'repeat', 'bills', 'catalog', 'reports', 'settings', 'printer']) assert.ok(k.includes(want as never), want);
  assert.equal(billingMenuEntries('CANTEEN_ADMIN').find((e) => e.key === 'catalog')?.label, 'Menu / Catalog');
});

test('sub admin gets catalog (availability) and printer but never reports or settings', () => {
  const k = keys('SUB_ADMIN');
  assert.ok(k.includes('catalog') && k.includes('printer') && k.includes('bills'));
  assert.ok(!k.includes('reports') && !k.includes('settings'));
});

test('unknown or customer roles get no admin-only entries', () => {
  for (const r of ['STUDENT', 'PARENT', 'TEACHER', undefined]) {
    assert.ok(!keys(r).includes('reports') && !keys(r).includes('settings'));
  }
});

test('every entry with a route points at a registered billing screen', () => {
  const routes = new Set(['BillingHistory', 'BillingCatalog', 'BillingReports', 'BillingSettings', 'BillingPrinter']);
  for (const e of billingMenuEntries('CANTEEN_ADMIN')) if (e.route) assert.ok(routes.has(e.route), e.route);
});

const bill = {
  id: 'x', invoiceNumber: 'INV-20261026-0001', billDate: '2026-10-26', createdAt: '2026-10-26T10:00:00Z',
  createdBy: 'u', createdByName: 'A', status: 'COMPLETED', voidReason: null, voidedAt: null, paymentMethod: 'CASH',
  paymentStatus: 'MANUAL_UNVERIFIED', subtotal: 52.5, gstPercent: 5, gstAmount: 2.63, total: 55.13,
  businessName: 'Canteen <b>', address: 'Main Rd', phone: '123', gstin: 'G1', footerMessage: 'Thanks', currencySymbol: 'Rs',
  lines: [{ itemId: 'i', itemName: 'Samosa', emoji: '', unitPrice: 10, quantity: 3, lineTotal: 30 }],
} as never;

test('receipt carries business, invoice, items, subtotal, GST and total', () => {
  const t = receiptText(bill);
  for (const s of ['INV-20261026-0001', 'Samosa x3', 'Rs30.00', 'Subtotal', 'GST 5%', 'TOTAL  Rs55.13', 'recorded manually']) assert.ok(t.includes(s), s);
});

test('receipt html escapes business-supplied text', () => {
  const h = receiptHtml(bill);
  assert.ok(h.includes('Canteen &lt;b&gt;') && !h.includes('Canteen <b>'));
  assert.ok(h.includes('@page{size:80mm'));
});

test('preview totals match the server rounding (half-up on paise)', () => {
  const t = previewTotals([{ price: 10, quantity: 3 }, { price: 7.5, quantity: 3 }], 5, true);
  assert.deepEqual(t, { subtotal: 52.5, gst: 2.63, total: 55.13 });
  assert.equal(previewTotals([{ price: 0.1, quantity: 1 }], 5, true).gst, 0.01);
  assert.equal(previewTotals([{ price: 10, quantity: 1 }], 5, false).gst, 0);
});
