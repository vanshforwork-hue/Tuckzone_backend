import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BILLING_ROLES, BILLING_ADMIN_ROLES, billingMenuEntries, canUseBilling, isBillingAdmin,
  previewTotals, setCartQty, cartFromLines, filterItems, receiptHtml, esc,
} from '../src/utils/billingLogic.js';

const ROLES = ['STUDENT', 'PARENT', 'TEACHER', 'CANTEEN_ADMIN', 'SUB_ADMIN', undefined, null, 'ADMIN'];

test('only Canteen Admin and Sub Admin can use billing; only Canteen Admin is billing admin', () => {
  assert.deepEqual(ROLES.filter(canUseBilling), ['CANTEEN_ADMIN', 'SUB_ADMIN']);
  assert.deepEqual(ROLES.filter(isBillingAdmin), ['CANTEEN_ADMIN']);
  assert.deepEqual(BILLING_ROLES, ['CANTEEN_ADMIN', 'SUB_ADMIN']);
  assert.deepEqual(BILLING_ADMIN_ROLES, ['CANTEEN_ADMIN']);
});

test('billing toolbar: unauthorized roles get nothing, sub admin gets no reports/settings', () => {
  for (const r of ['STUDENT', 'PARENT', 'TEACHER', undefined, null]) assert.deepEqual(billingMenuEntries(r), []);
  const sub = billingMenuEntries('SUB_ADMIN').map((e) => e.key);
  assert.deepEqual(sub, ['held', 'repeat', 'bills', 'catalog', 'printer']);
  assert.equal(billingMenuEntries('SUB_ADMIN').find((e) => e.key === 'catalog').label, 'Menu availability');
  const admin = billingMenuEntries('CANTEEN_ADMIN').map((e) => e.key);
  assert.deepEqual(admin, ['held', 'repeat', 'bills', 'catalog', 'printer', 'reports', 'settings']);
});

test('nav + routes: /billing appears only for admin and sub admin, other roles untouched', () => {
  const layout = readFileSync(new URL('../src/components/Layout.jsx', import.meta.url), 'utf8');
  const body = layout.slice(layout.indexOf('switch (role)'), layout.indexOf('const subtitle'));
  const blocks = body.split(/\n\s*case /).slice(1);
  const withBilling = blocks.filter((b) => b.includes("'/billing'")).map((b) => b.match(/^'(\w+)'/)[1]);
  assert.deepEqual(withBilling, ['CANTEEN_ADMIN', 'SUB_ADMIN']);
  for (const role of ['STUDENT', 'PARENT']) assert.ok(!blocks.find((b) => b.startsWith(`'${role}'`))?.includes('/billing'));

  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /allowedRoles=\{BILLING_ROLES\}[\s\S]*path="\/billing"/);
  assert.match(app, /allowedRoles=\{BILLING_ADMIN_ROLES\}[\s\S]*path="\/billing\/reports"[\s\S]*path="\/billing\/settings"/);
  // Reports/settings must sit inside the admin-only guard, after it and before the sub-admin block.
  assert.ok(app.indexOf('BILLING_ADMIN_ROLES}') < app.indexOf('/billing/reports'));
  assert.ok(app.indexOf('/billing/settings') < app.indexOf('Sub Admin Only'));
});

test('totals: exclusive GST, half-up rounding in paise, no float drift', () => {
  assert.deepEqual(previewTotals([{ price: 100, quantity: 2 }], 5, true), { subtotal: 200, gst: 10, total: 210 });
  assert.deepEqual(previewTotals([{ price: 100, quantity: 2 }], 5, false), { subtotal: 200, gst: 0, total: 200 });
  // 0.1 + 0.2 style drift: 3 x 0.10 must be exactly 0.30
  assert.equal(previewTotals([{ price: 0.1, quantity: 3 }], 0, true).subtotal, 0.3);
  // 12.50 x 1 @ 5% = 0.625 -> rounds half-up to 0.63
  assert.equal(previewTotals([{ price: 12.5, quantity: 1 }], 5, true).gst, 0.63);
  assert.deepEqual(previewTotals([], 5, true), { subtotal: 0, gst: 0, total: 0 });
});

test('cart quantity: clamps to 0..999, zero removes, input is not mutated', () => {
  const cart = { a: 2 };
  assert.deepEqual(setCartQty(cart, 'a', 5), { a: 5 });
  assert.deepEqual(cart, { a: 2 });
  assert.deepEqual(setCartQty(cart, 'a', 0), {});
  assert.deepEqual(setCartQty(cart, 'a', -3), {});
  assert.deepEqual(setCartQty(cart, 'b', 5000), { a: 2, b: 999 });
  assert.deepEqual(setCartQty(cart, 'b', NaN), { a: 2 });
  assert.deepEqual(setCartQty(cart, 'b', 2.9), { a: 2, b: 2 });
});

test('hold/resume/repeat: lines are re-priced from today\'s catalog; unavailable or removed items are skipped', () => {
  const byId = new Map([
    ['a', { id: 'a', available: true }],
    ['b', { id: 'b', available: false }],
  ]);
  const { cart, skipped } = cartFromLines(
    [{ itemId: 'a', quantity: 2 }, { itemId: 'a', quantity: 1 }, { itemId: 'b', quantity: 1 }, { itemId: 'gone', quantity: 4 }],
    byId,
  );
  assert.deepEqual(cart, { a: 3 });
  assert.equal(skipped, 2);
});

test('item search and category filter', () => {
  const items = [
    { id: 1, name: 'Samosa', categoryId: 'snacks' },
    { id: 2, name: 'Tea', categoryId: 'drinks' },
    { id: 3, name: 'Samosa Chaat', categoryId: 'snacks' },
  ];
  assert.equal(filterItems(items, 'ALL', '').length, 3);
  assert.deepEqual(filterItems(items, 'ALL', '  SAMOSA ').map((i) => i.id), [1, 3]);
  assert.deepEqual(filterItems(items, 'drinks', '').map((i) => i.id), [2]);
  assert.deepEqual(filterItems(items, 'drinks', 'samosa'), []);
});

const bill = {
  invoiceNumber: 'INV-1', createdAt: '2026-10-26T10:00:00Z', status: 'COMPLETED', currencySymbol: 'Rs',
  businessName: 'Canteen <b>&"', address: '', phone: '', gstin: '', footerMessage: 'Thanks',
  subtotal: 200, gstPercent: 5, gstAmount: 10, total: 210, paymentMethod: 'CASH',
  lines: [{ itemName: '<script>x</script>', quantity: 2, lineTotal: 200 }],
};

test('receipt: escapes every field, shows GST/total/payment, marks void', () => {
  const html = receiptHtml(bill);
  assert.ok(!html.includes('<script>x'));
  assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt; x2'));
  assert.ok(html.includes('Canteen &lt;b&gt;&amp;&quot;'));
  assert.ok(html.includes('GST 5%') && html.includes('Rs210.00') && html.includes('Paid by: CASH'));
  assert.ok(!html.includes('VOID'));
  assert.ok(receiptHtml({ ...bill, status: 'VOID' }).includes('*** VOID ***'));
  assert.ok(!receiptHtml({ ...bill, gstAmount: 0 }).includes('GST 5%'));
  assert.equal(esc(null), '');
});

test('printer: toolbar entry for both billing roles, route outside the admin-only block, no header scrollbar', () => {
  for (const r of ['CANTEEN_ADMIN', 'SUB_ADMIN']) {
    assert.deepEqual(billingMenuEntries(r).find((e) => e.key === 'printer'), { key: 'printer', label: 'Printer', to: '/billing/printer' });
  }
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /allowedRoles=\{BILLING_ROLES\}[\s\S]*path="\/billing\/printer"[\s\S]*allowedRoles=\{BILLING_ADMIN_ROLES\}/);
  const css = readFileSync(new URL('../src/components/Layout.css', import.meta.url), 'utf8');
  const tabs = css.slice(css.indexOf('.tz-top-tabs {'), css.indexOf('}', css.indexOf('.tz-top-tabs {')));
  assert.match(tabs, /flex-wrap:\s*wrap/);
  assert.doesNotMatch(tabs, /overflow/);
});

test('test-print receipt is branded, escaped and marked not a sale', () => {
  const page = readFileSync(new URL('../src/pages/billing/BillingPrinterPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /TEST PRINT - NOT A SALE/);
  assert.doesNotMatch(page, /createBill/);
});

test('receipt width: 57/80 choices, default 80, invalid falls back, drives @page and body width', async () => {
  const { RECEIPT_WIDTHS, parseReceiptWidth, getReceiptWidth, saveReceiptWidth } = await import('../src/utils/billingLogic.js');
  assert.deepEqual(RECEIPT_WIDTHS, [57, 80]);
  assert.equal(getReceiptWidth(), 80); // no localStorage in node
  for (const bad of ['abc', 0, 58, null, undefined, '57; x{}', {}]) assert.equal(parseReceiptWidth(bad), 80);
  assert.equal(parseReceiptWidth('57'), 57);
  globalThis.localStorage = { v: null, getItem() { return this.v; }, setItem(k, v) { this.v = v; } };
  saveReceiptWidth(57); assert.equal(getReceiptWidth(), 57);
  globalThis.localStorage.v = 'garbage'; assert.equal(getReceiptWidth(), 80);
  delete globalThis.localStorage;
  const long = { ...bill, lines: [{ itemName: 'A'.repeat(80), quantity: 1, lineTotal: 10 }] };
  const h57 = receiptHtml(long, 57), h80 = receiptHtml(long, 80);
  assert.match(h57, /@page\{size:57mm auto;margin:2mm\}/);
  assert.match(h57, /body\{font:11px monospace;width:53mm;overflow-wrap:anywhere\}/);
  assert.match(h80, /@page\{size:80mm auto;margin:4mm\}/);
  assert.match(h80, /width:72mm/);
  assert.match(h57, /table-layout:fixed/);
  assert.match(receiptHtml(bill, '57; evil'), /size:80mm/);
});

test('printer page: width selector wired to preview + print, test print never touches a sale API', () => {
  const page = readFileSync(new URL('../src/pages/billing/BillingPrinterPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /receiptHtml\(bill, width\)/);
  assert.match(page, /printReceipt\(bill, width\)/);
  assert.match(page, /RECEIPT_WIDTHS\.map/);
  assert.match(page, /Direct Bluetooth printing is not supported/);
  assert.match(page, /TEST PRINT - NOT A SALE/);
  assert.ok(!/createBill|voidBill|billingApi\.(hold|resume)/.test(page));
});
