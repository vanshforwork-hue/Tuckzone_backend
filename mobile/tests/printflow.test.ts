// Mocked transport/API tests. These are NOT hardware tests. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveThenPrint, tryPrint, sendBytes, PrinterWriteError, savedButNotPrinted } from '../src/utils/printFlow.ts';
import { testEscPos, receiptEscPos, WIDTH_MM_TO_CHARS } from '../src/utils/escpos.ts';
import { billingMenuGroups } from '../src/screens/billing/billingMenu.ts';

const dec = (u: Uint8Array) => Buffer.from(u).toString('latin1');
const bill = {
  invoiceNumber: 'INV-1', createdAt: '2026-01-01T10:00:00Z', status: 'COMPLETED', paymentMethod: null,
  subtotal: 100, gstPercent: 0, gstAmount: 0, total: 100, businessName: 'Tuck Zone', address: '', phone: '', gstin: '',
  footerMessage: '', currencySymbol: 'Rs', lines: [{ itemName: 'A very long item name that must wrap onto lines', quantity: 2, lineTotal: 100 }],
} as never;

test('print failure after save: one save, retry prints the same bill without saving again', async () => {
  let saves = 0; let prints = 0;
  const save = async () => { saves++; return { id: 'b1' }; };
  const print = async () => { if (++prints === 1) throw new Error('Printer off.'); };
  const r = await saveThenPrint(save, print);
  assert.equal(r.printError, 'Printer off.');
  assert.equal(saves, 1);
  assert.equal(await tryPrint(r.bill, print), null);
  assert.equal(saves, 1);
  assert.equal(prints, 2);
  assert.match(savedButNotPrinted('Printer off.'), /^Bill saved, but printing failed/);
});

test('save failure: nothing printed, error propagates', async () => {
  let prints = 0;
  await assert.rejects(saveThenPrint(async () => { throw new Error('409'); }, async () => { prints++; }), /409/);
  assert.equal(prints, 0);
});

test('sendBytes: chunks, binary-safe, reports disconnect and timeout', async () => {
  const got: string[] = [];
  const ok = { isConnected: async () => true, write: async (d: string) => { got.push(d); } };
  await sendBytes(ok, Uint8Array.from([0x1b, 0x40, 0xff, 0x80]), { chunkSize: 3 });
  assert.deepEqual(got.map((g) => g.length), [3, 1]);
  assert.equal(got.join('').charCodeAt(2), 0xff);

  await assert.rejects(sendBytes({ isConnected: async () => false, write: async () => {} }, new Uint8Array(1)),
    (e: unknown) => e instanceof PrinterWriteError && e.disconnected);
  await assert.rejects(sendBytes({ isConnected: async () => true, write: async () => { throw new Error('broken pipe'); } }, new Uint8Array(1)), /broken pipe/);
  await assert.rejects(sendBytes({ isConnected: async () => true, write: () => new Promise(() => {}) }, new Uint8Array(1), { timeoutMs: 20 }), /did not respond/);
});

test('test print is marked and contains no sale data; cut only when enabled', () => {
  const t = testEscPos(32, false);
  assert.match(dec(t), /TEST PRINT - NOT A SALE/);
  assert.ok(!dec(t).includes('Bill:'));
  const cut = [0x1d, 0x56, 0x42, 0x00];
  assert.notDeepEqual([...t.subarray(-4)], cut);
  assert.deepEqual([...testEscPos(32, true).subarray(-4)], cut);
});

test('57 mm = 32 cols, 80 mm = 48 cols; no line exceeds width and amounts survive', () => {
  assert.deepEqual(WIDTH_MM_TO_CHARS, { 57: 32, 80: 48 });
  for (const w of [32, 48] as const) {
    const lines = dec(receiptEscPos(bill, w, false)).split('\n');
    assert.ok(lines.every((l) => l.replace(/\x1b[@]|\x1b[aE]./g, '').replace(/[\x00-\x1f]/g, '').length <= w), `width ${w}`);
    assert.ok(lines.some((l) => /Rs100\.00/.test(l)));
  }
});

test('menu groups: Sell/Sales/Menu/Tools, reports+settings admin-only', () => {
  const k = (r: string) => billingMenuGroups(r).map((g) => `${g.key}:${g.entries.map((e) => e.key).join(',')}`);
  assert.deepEqual(k('SUB_ADMIN'), ['sell:held,repeat', 'sales:bills', 'menu:catalog', 'tools:printer']);
  assert.deepEqual(k('CANTEEN_ADMIN'), ['sell:held,repeat', 'sales:bills,reports', 'menu:catalog', 'tools:printer,settings']);
});
