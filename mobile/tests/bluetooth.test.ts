// Mocked Web Bluetooth tests. These are NOT hardware tests. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { receiptEscPos, testEscPos, chunk, toAscii, twoCol } from '../src/utils/escpos.ts';
import * as ble from '../src/utils/webBluetoothPrinter.ts';

const bill = {
  invoiceNumber: 'INV-1', createdAt: '2026-01-01T10:00:00Z', status: 'PAID', paymentMethod: 'CASH',
  subtotal: 100, gstPercent: 5, gstAmount: 5, total: 105, businessName: 'Tuck Zone', address: '1 Main Rd',
  phone: '99', gstin: 'G1', footerMessage: 'Thanks', currencySymbol: '₹',
  lines: [{ itemName: 'Samosa', quantity: 2, lineTotal: 100 }],
} as never;
const dec = (u: Uint8Array) => Buffer.from(u).toString('latin1');

test('escpos: init, totals, GST, ASCII-only rupee, cut', () => {
  const b = receiptEscPos(bill);
  assert.deepEqual([...b.subarray(0, 2)], [0x1b, 0x40]);
  const t = dec(b);
  assert.match(t, /Rs\.100\.00/);
  assert.match(t, /GST 5%\s+Rs\.5\.00/);
  assert.match(t, /TOTAL\s+Rs\.105\.00/);
  assert.match(t, /Bill: INV-1/);
  assert.deepEqual([...b.subarray(-4)], [0x1d, 0x56, 0x42, 0x00]);
  assert.ok(!t.includes('₹'));
});

test('escpos: no GST line when zero; amount never truncated', () => {
  const t = dec(receiptEscPos({ ...(bill as object), gstAmount: 0, lines: [{ itemName: 'X'.repeat(80), quantity: 1, lineTotal: 12345.5 }] } as never));
  assert.ok(!/GST [0-9]/.test(t));
  assert.match(t, /Rs\.12345\.50/);
  assert.equal(twoCol('abcdefghij', '1.00', 8).length, 8);
  assert.equal(toAscii('Café ₹'), 'Cafe Rs.');
});

test('chunk splits without loss', () => {
  const d = Uint8Array.from({ length: 250 }, (_, i) => i % 256);
  const parts = chunk(d, 100);
  assert.deepEqual(parts.map((p) => p.length), [100, 100, 50]);
  assert.deepEqual(Buffer.concat(parts), Buffer.from(d));
  assert.throws(() => chunk(d, 0));
});

test('detectSupport: insecure, missing API, ok', () => {
  assert.equal(ble.detectSupport({ bluetooth: {} }, false).ok, false);
  assert.equal(ble.detectSupport({}, true).ok, false);
  assert.equal(ble.detectSupport(undefined, true).ok, false);
  assert.equal(ble.detectSupport({ bluetooth: {} }, true).ok, true);
});

function mockNav(opts: { reject?: string; noGatt?: boolean; props?: { write: boolean; writeWithoutResponse: boolean }; failWrite?: boolean } = {}) {
  const writes: Uint8Array[] = [];
  let drop: () => void = () => {};
  const server = {
    connected: true,
    disconnect() { this.connected = false; },
    async getPrimaryServices() {
      return [{
        uuid: 's',
        async getCharacteristics() {
          return [{
            uuid: 'c',
            properties: opts.props ?? { write: true, writeWithoutResponse: false },
            async writeValueWithResponse(v: Uint8Array) {
              if (opts.failWrite) throw new Error('GATT write failed');
              writes.push(Uint8Array.from(v));
            },
          }];
        },
      }];
    },
  };
  const device = {
    name: 'MockPrinter',
    gatt: opts.noGatt ? undefined : { connect: async () => server },
    addEventListener: (_: string, f: () => void) => { drop = f; },
    removeEventListener: () => {},
  };
  const nav = {
    requestDevice: async () => {
      if (opts.reject) throw Object.assign(new Error(opts.reject), { name: opts.reject });
      return device;
    },
  };
  return { nav: nav as never, writes, server, dropNow: () => { server.connected = false; drop(); } };
}

test('connect: cancel, permission denied, no GATT, no writable characteristic', async () => {
  await ble.connect(mockNav({ reject: 'NotFoundError' }).nav);
  assert.equal(ble.getStatus().state, 'disconnected');
  await ble.connect(mockNav({ reject: 'SecurityError' }).nav);
  assert.equal(ble.getStatus().state, 'error');
  assert.match(ble.getStatus().message!, /permission/);
  await ble.connect(mockNav({ noGatt: true }).nav);
  assert.match(ble.getStatus().message!, /Classic/);
  await ble.connect(mockNav({ props: { write: false, writeWithoutResponse: false } }).nav);
  assert.equal(ble.getStatus().state, 'error');
  assert.match(ble.getStatus().message!, /writable/);
  await assert.rejects(ble.send(testEscPos()), /not connected/);
});

test('connect, print receipt in chunks, disconnect', async () => {
  const m = mockNav();
  await ble.connect(m.nav);
  assert.equal(ble.getStatus().state, 'connected');
  const data = receiptEscPos(bill);
  await ble.send(data);
  assert.deepEqual(Buffer.concat(m.writes), Buffer.from(data));
  ble.disconnect();
  assert.equal(ble.getStatus().state, 'disconnected');
  assert.equal(m.server.connected, false);
});

test('write failure and mid-print disconnect surface as errors', async () => {
  await ble.connect(mockNav({ failWrite: true }).nav);
  await assert.rejects(ble.send(testEscPos()), /Print failed: GATT write failed/);
  const m = mockNav();
  await ble.connect(m.nav);
  m.dropNow();
  assert.equal(ble.getStatus().state, 'error');
  await assert.rejects(ble.send(testEscPos()), /not connected/);
});
